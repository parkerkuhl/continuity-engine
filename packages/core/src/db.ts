import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Bundlers that move this file (the Next.js app) set CONTINUITY_MIGRATIONS to the drizzle folder. */
const MIGRATIONS_DIR = "../drizzle"; // a variable, so bundlers don't try to pull the folder in as an asset
const migrationsFolder = () => process.env.CONTINUITY_MIGRATIONS || fileURLToPath(new URL(MIGRATIONS_DIR, import.meta.url));

/** Open (or create) a database file, or ":memory:", and bring it to the latest migration. */
export function openDb(path = ":memory:"): Db {
  const client = new Database(path);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  const db = drizzle({ client, schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}
