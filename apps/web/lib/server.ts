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
export const worldScope = cache(async (worldId: string): Promise<Scope> => {
  const spoilers = (await cookies()).get(WORLD_SPOILERS_COOKIE)?.value === "on";
  const s = await (await app()).views.scope({ worldId, spoilers });
  if (!s) notFound();
  return s;
});

// Scopes and read models are cached per request (UX review #32): the layout, the sidebar and the page share one
// scope object, so each of these runs once per request however many components ask.
export const campaignScope = cache(async (campaignId: string): Promise<Scope> => {
  const { engine, views } = await app();
  const c = await engine.storage.getCampaign(campaignId);
  if (!c) notFound();
  const s = await views.scope({ worldId: c.worldId, campaignId });
  if (!s) notFound();
  return s;
});

export const wikiView = cache(async (scope: Scope, query?: string) => (await app()).views.wiki(scope, query ? { query } : {}));
export const reviewQueue = cache(async (scope: Scope) => (await app()).views.reviewQueue(scope));
export const pageQueue = cache(async (scope: Scope) => (await app()).views.pageQueue(scope));
export const dashboard = cache(async (scope: Scope) => (await app()).views.dashboard(scope));

/** Where a scope's screens live. */
export function basePath(s: Scope): string {
  return s.campaign ? `/c/${s.campaign.id}` : `/w/${s.world.id}`;
}

/**
 * The browser-tab title for a world or campaign screen: "GM · " in GM view, then the screen, then the campaign
 * (or world) name, so tabs for different worlds never look alike. Only public names go in a title.
 */
export async function scopeTitle(scope: Scope, part?: string | null): Promise<{ title: string }> {
  return { title: [scope.spoilers ? "GM" : null, part, scope.campaign?.name ?? scope.world.name].filter(Boolean).join(" · ") };
}

/** An entity page's name for its tab title, resolved from the URL slug (or an alias). */
export async function entityName(scope: Scope, slug: string): Promise<string | null> {
  const r = await (await app()).engine.storage.resolveEntity(scope.world.id, slug, { campaignId: scope.campaign?.id ?? null });
  return r.status === "resolved" ? r.entity.name : null;
}

/** UX review #4: the GM's page edits in play the user hasn't reviewed. Two browser cookies per campaign hold
 *  "reviewed up to" (Keep all) and the version ids kept one by one since then. */
export const reviewedCookie = (campaignId: string) => `ce-reviewed-${campaignId}`;
export const keptCookie = (campaignId: string) => `ce-kept-${campaignId}`;

export const pageChanges = cache(async (scope: Scope) => {
  if (!scope.campaign) return [];
  const jar = await cookies();
  const since = jar.get(reviewedCookie(scope.campaign.id))?.value ?? null;
  const kept = (jar.get(keptCookie(scope.campaign.id))?.value ?? "").split(",").filter(Boolean);
  return (await app()).views.pageChanges(scope, { since, kept });
});
