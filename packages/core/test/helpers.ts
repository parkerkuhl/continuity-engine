import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach } from "vitest";
import { PgStorage, SqliteStorage, type WriteMeta } from "../src";

export const AI: WriteMeta = { author: "ai" };
export const USER: WriteMeta = { author: "user" };

export type TestStorage = SqliteStorage | PgStorage;

/**
 * Which backend the suite runs on (Milestone 8 runs every core test on both):
 * - unset or `sqlite`: SQLite in memory (the default)
 * - `pglite`: embedded Postgres in memory
 * - `postgres`: a real server at `CONTINUITY_TEST_PG_URL`; each store gets its own new database
 */
export const BACKEND = process.env.CONTINUITY_TEST_BACKEND ?? "sqlite";

const opened: TestStorage[] = [];
const dropDbs: string[] = [];
// PGlite instances are heavy, so each test's stores close when it ends.
afterEach(() => {
  if (BACKEND !== "sqlite") for (const s of opened.splice(0)) s.close();
});
afterAll(async () => {
  for (const s of opened.splice(0)) s.close();
  if (dropDbs.length) {
    const admin = postgres(process.env.CONTINUITY_TEST_PG_URL!, { onnotice: () => {} });
    await new Promise((r) => setTimeout(r, 50));
    for (const db of dropDbs.splice(0)) await admin.unsafe(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
    await admin.end();
  }
}, 120_000);

/** An empty store on the backend under test. */
export async function openStore(): Promise<TestStorage> {
  let store: TestStorage;
  if (BACKEND === "sqlite") store = SqliteStorage.open(":memory:");
  else if (BACKEND === "pglite") store = await PgStorage.open("pglite:");
  else if (BACKEND === "postgres") {
    const base = process.env.CONTINUITY_TEST_PG_URL;
    if (!base) throw new Error("CONTINUITY_TEST_PG_URL is required for CONTINUITY_TEST_BACKEND=postgres");
    const name = `ce_test_${randomUUID().replace(/-/g, "")}`;
    const admin = postgres(base, { onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    await admin.end();
    dropDbs.push(name);
    const url = new URL(base);
    url.pathname = `/${name}`;
    store = await PgStorage.open(url.toString());
  } else throw new Error(`unknown CONTINUITY_TEST_BACKEND ${BACKEND}`);
  opened.push(store);
  return store;
}

/** A fresh store with one user and one world. */
export async function setup() {
  const storage = await openStore();
  const user = await storage.createUser({ name: "Parker" }, USER);
  const world = await storage.createWorld(
    { ownerId: user.id, name: "The Free Cities", pitch: "Sellswords and old debts.", depth: "compact", defaultApprovalMode: "batch" },
    USER,
  );
  return { storage, user, world };
}

/** The spec's own example entity, plus a few neighbours. */
export async function seed(storage: TestStorage, worldId: string) {
  const rickard = await storage.createEntity(
    {
      worldId,
      type: "character",
      name: "Rickard Snow",
      aliases: ["Snow", "the bastard sellsword", "Commander"],
      source: "invention",
      summary: "Sellsword captain, Golden Company, outside Volantis. Wounded left shoulder (ch-12).",
      sections: [
        { heading: "Appearance", bodyMd: "Tall, grey-eyed, a burn scar along the jaw.", lockedByUser: true },
        { heading: "Wants", bodyMd: "Land of his own.\n\n### Short term\nPay the company before winter." },
        { heading: "Hiding", bodyMd: "His mother's name, and why it matters in Volantis.", visibility: "secret" },
      ],
    },
    AI,
  );
  const company = await storage.createEntity(
    {
      worldId,
      type: "faction",
      name: "Golden Company",
      aliases: ["the Company", "Goldcloaks"],
      source: "canon",
      summary: "The largest sellsword company in Essos.",
      sections: [{ heading: "Aims", bodyMd: "Return to Westeros." }],
    },
    AI,
  );
  const volantis = await storage.createEntity(
    { worldId, type: "place", name: "Volantis", aliases: ["Old Volantis"], source: "canon", summary: "The oldest Free City." },
    AI,
  );
  const glossary = await storage.createEntity(
    {
      worldId,
      type: "concept",
      name: "Glossary",
      source: "invention",
      sections: [{ heading: "Oaths", bodyMd: "- *By the Black Wall* — Volantene oath." }],
    },
    AI,
  );
  return { rickard, company, volantis, glossary };
}
