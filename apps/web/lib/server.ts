/**
 * The web app's one connection to packages/core.
 *
 * - **Local** (no `CONTINUITY_DATABASE_URL`): the same SQLite file as the stdio MCP server (CONTINUITY_DB,
 *   default ~/.continuity-engine/continuity.db), one engine per process, no sign-in. Unchanged from M5.
 * - **Remote** (Milestone 8, `CONTINUITY_DATABASE_URL` set): Postgres (Supabase), sign-in required. Each
 *   request gets an engine scoped to the signed-in account (`scopeStorage`), so it sees only its own worlds.
 */
import { RulesEngine, SqliteStorage, WebViews, openRemote, scopeStorage, type PgStorage, type RemoteStore, type Scope } from "@continuity/core";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { currentAccount } from "./auth";

export type App = { engine: RulesEngine; views: WebViews };
type Remote = { storage: PgStorage; remote: RemoteStore };
const g = globalThis as unknown as { __continuity?: App & { dbPath: string }; __continuityRemote?: Promise<Remote> };

export const isRemote = () => !!process.env.CONTINUITY_DATABASE_URL;

/** The remote database (one pool per server instance). Migrations run on first open. */
export function remoteDb(): Promise<Remote> {
  if (!g.__continuityRemote) {
    process.env.CONTINUITY_PG_MIGRATIONS ||= resolve(process.cwd(), "../../packages/core/drizzle-pg");
    g.__continuityRemote = openRemote(process.env.CONTINUITY_DATABASE_URL!).catch((e) => {
      g.__continuityRemote = undefined;
      throw e;
    });
  }
  return g.__continuityRemote;
}

/** An engine for one account on the remote database. Also used by the /mcp endpoint. */
export async function engineFor(userId: string): Promise<RulesEngine> {
  const { storage, remote } = await remoteDb();
  return new RulesEngine(scopeStorage(storage, userId), { ownerId: userId, imports: remote.imports() });
}

/** Make sure the account has its `users` row (its id is the Supabase user id). */
export async function ensureUser(id: string, name: string): Promise<void> {
  const { storage } = await remoteDb();
  if (!(await storage.getUser(id))) await storage.createUser({ id, name }, { author: "user", reason: "first sign-in" });
}

function local(): App & { dbPath: string } {
  if (!g.__continuity) {
    // The bundler moves packages/core, so tell openDb where its migrations live.
    process.env.CONTINUITY_MIGRATIONS ||= resolve(process.cwd(), "../../packages/core/drizzle");
    const dbPath = process.env.CONTINUITY_DB || join(homedir(), ".continuity-engine", "continuity.db");
    if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
    const engine = new RulesEngine(SqliteStorage.open(dbPath));
    g.__continuity = { engine, views: new WebViews(engine), dbPath };
  }
  return g.__continuity;
}

export const localDbPath = () => local().dbPath;

/** The engine and views for this request. Remote: scoped to the signed-in account, or a redirect to sign-in. */
export const app = cache(async (): Promise<App> => {
  if (!isRemote()) return local();
  const account = await currentAccount();
  if (!account) redirect("/login");
  await ensureUser(account.id, account.name);
  const engine = await engineFor(account.id);
  return { engine, views: new WebViews(engine) };
});

export const WORLD_SPOILERS_COOKIE = "spoilers";

/** A world screen's scope. World screens keep their spoiler toggle in a cookie; campaigns keep their own. */
export async function worldScope(worldId: string): Promise<Scope> {
  const spoilers = (await cookies()).get(WORLD_SPOILERS_COOKIE)?.value === "on";
  const s = await (await app()).views.scope({ worldId, spoilers });
  if (!s) notFound();
  return s;
}

export async function campaignScope(campaignId: string): Promise<Scope> {
  const { engine, views } = await app();
  const c = await engine.storage.getCampaign(campaignId);
  if (!c) notFound();
  const s = await views.scope({ worldId: c.worldId, campaignId });
  if (!s) notFound();
  return s;
}

/** Where a scope's screens live. */
export function basePath(s: Scope): string {
  return s.campaign ? `/c/${s.campaign.id}` : `/w/${s.world.id}`;
}
