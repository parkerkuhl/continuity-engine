import { SqliteStorage, type WriteMeta } from "../src";

export const AI: WriteMeta = { author: "ai" };
export const USER: WriteMeta = { author: "user" };

/** A fresh in-memory store with one user and one world. */
export async function setup() {
  const storage = SqliteStorage.open(":memory:");
  const user = await storage.createUser({ name: "Parker" }, USER);
  const world = await storage.createWorld(
    { ownerId: user.id, name: "The Free Cities", pitch: "Sellswords and old debts.", depth: "compact", defaultApprovalMode: "batch" },
    USER,
  );
  return { storage, user, world };
}

/** The spec's own example entity, plus a few neighbours. */
export async function seed(storage: SqliteStorage, worldId: string) {
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
