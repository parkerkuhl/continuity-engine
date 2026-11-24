/**
 * The web app's one connection to packages/core: the same database file as the MCP server
 * (CONTINUITY_DB, default ~/.continuity-engine/continuity.db), the same storage and rules engine.
 */
import { RulesEngine, SqliteStorage, WebViews, type Scope } from "@continuity/core";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

type App = { engine: RulesEngine; views: WebViews; dbPath: string };
const g = globalThis as unknown as { __continuity?: App };

export function app(): App {
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

export const WORLD_SPOILERS_COOKIE = "spoilers";

/** A world screen's scope. World screens keep their spoiler toggle in a cookie; campaigns keep their own. */
export async function worldScope(worldId: string): Promise<Scope> {
  const spoilers = (await cookies()).get(WORLD_SPOILERS_COOKIE)?.value === "on";
  const s = await app().views.scope({ worldId, spoilers });
  if (!s) notFound();
  return s;
}

export async function campaignScope(campaignId: string): Promise<Scope> {
  const c = await app().engine.storage.getCampaign(campaignId);
  if (!c) notFound();
  const s = await app().views.scope({ worldId: c.worldId, campaignId });
  if (!s) notFound();
  return s;
}

/** Where a scope's screens live. */
export function basePath(s: Scope): string {
  return s.campaign ? `/c/${s.campaign.id}` : `/w/${s.world.id}`;
}
