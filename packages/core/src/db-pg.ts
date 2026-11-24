/**
 * Opens a Postgres database for `PgStorage` (Milestone 8) and brings it to the latest migration.
 *
 * - `postgres://…` / `postgresql://…`: a real server (Supabase in production) through postgres-js.
 *   With Supabase's transaction pooler (port 6543) prepared statements must be off; set
 *   `CONTINUITY_PG_PREPARE=0` or use a URL with `?prepare=false`.
 * - `pglite:` (in memory) or `pglite:<dir>`: embedded Postgres, for tests and local runs with no server.
 */
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { fileURLToPath } from "node:url";
import * as schema from "./schema-pg";

export type PgDb = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_DIR = "../drizzle-pg"; // a variable, so bundlers don't try to pull the folder in as an asset
const migrationsFolder = () => process.env.CONTINUITY_PG_MIGRATIONS || fileURLToPath(new URL(MIGRATIONS_DIR, import.meta.url));

export async function openPgDb(url: string): Promise<{ db: PgDb; close: () => Promise<void> }> {
  if (url === "pglite:" || url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = url.slice("pglite:".length);
    const client = dir ? new PGlite(dir) : new PGlite();
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    return { db: db as unknown as PgDb, close: () => client.close() };
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const parsed = new URL(url);
  const noPrepare = process.env.CONTINUITY_PG_PREPARE === "0" || parsed.searchParams.get("prepare") === "false";
  parsed.searchParams.delete("prepare");
  const client = postgres(parsed.toString(), { prepare: !noPrepare, max: Number(process.env.CONTINUITY_PG_POOL ?? 5), onnotice: () => {} });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return { db: db as unknown as PgDb, close: () => client.end() };
}
