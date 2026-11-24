// Milestone 6 acceptance (SPEC "Phase 0: building the world"), driven through the MCP server as Claude would:
//  - A multi-file world bible imported, with duplicates and disagreements flagged before confirm
//  - An established-universe skeleton stored as `unverified` and labeled in context
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RulesEngine, SqliteStorage } from "@continuity/core";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server";

type Call = { text: string; status: Record<string, unknown>; isError: boolean };

async function connect() {
  const storage = SqliteStorage.open(":memory:");
  const engine = new RulesEngine(storage);
  const server = createServer(engine);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<Call> => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
    return { text: r.content[0]!.text, status: JSON.parse(r.content[1]!.text), isError: !!r.isError };
  };
  return { call, engine, storage };
}

async function world() {
  const c = await connect();
  const w = await c.call("create_world", { name: "The Free Cities", pitch: "Sellswords and old debts.", depth: "compact", approval_mode: "batch" });
  return { ...c, worldId: w.status.world_id as string };
}

const versions = async (s: SqliteStorage) => (await s.listVersions({})).length;

describe("M6: a multi-file world bible imported, with duplicates and disagreements flagged before confirm", () => {
  it("flags wiki duplicates, cross-file duplicates and every kind of disagreement, and writes only what is accepted", async () => {
    const g = await world();
    await g.call("create_entity", { world_id: g.worldId, type: "place", name: "Volantis", aliases: ["Old Volantis"], source: "canon", summary: "The oldest Free City." });
    const before = await versions(g.storage);

    const people = await g.call("import_document", {
      world_id: g.worldId,
      title: "people.md",
      entities: [
        { type: "character", name: "Marro", aliases: ["the squire"], summary: "Rickard's squire, sixteen." },
        { type: "character", name: "Rickard Snow", summary: "Sellsword captain." },
      ],
    });
    const places = await g.call("import_document", {
      world_id: g.worldId,
      title: "places.md",
      entities: [
        { type: "faction", name: "Old Volantis", aliases: ["the Black Walls"], summary: "A city of black walls." },
        { type: "character", name: "The Squire", summary: "Rickard's squire, fourteen." },
        { type: "place", name: "Lys", summary: "City of perfumes." },
        { type: "place", name: "lys", summary: "Perfumed gardens." },
      ],
    });

    // Duplicates of wiki pages, with type, summary and alias differences.
    expect(places.text).toContain("[0] Old Volantis (faction) — likely duplicate of **volantis**");
    expect(places.text).toContain('disagrees on type: wiki says "place", file says "faction"');
    expect(places.text).toContain('disagrees on summary: wiki says "The oldest Free City.", file says "A city of black walls."');
    expect(places.text).toContain("adds aliases the wiki lacks: the Black Walls");
    // The same character in two files, found by alias, and where the files disagree.
    expect(places.text).toContain('also in item [0] of pending import "people.md"');
    expect(places.text).toContain('the files disagree on summary: "Rickard\'s squire, sixteen." vs "Rickard\'s squire, fourteen."');
    // A duplicate inside one file.
    expect(places.text).toMatch(/\[3\] lys \(place\) — new\n {2}- also in item \[2\] of this file as Lys/);
    // Nothing written before confirm.
    expect(await versions(g.storage)).toBe(before);
    expect(await g.storage.getEntityBySlug(g.worldId, "marro")).toBeNull();

    // The user keeps people.md's Marro and Rickard, and places.md's first Lys; the duplicate Volantis is refused.
    const c1 = await g.call("confirm_import", { import_id: people.status.import_id, accepted: [0, 1] });
    expect(c1.isError).toBe(false);
    const c2 = await g.call("confirm_import", { import_id: places.status.import_id, accepted: [0, 2] });
    expect(c2.text).toContain("Lys (lys");
    expect(c2.text).toMatch(/Item 0 \*\*refused\*\*[^\n]*volantis/i);
    expect((await g.storage.getEntityBySlug(g.worldId, "marro"))!.source).toBe("canon");
    expect((await g.storage.getEntityBySlug(g.worldId, "volantis"))!.type).toBe("place"); // the wiki page is untouched
  });

  it("a pending import stops counting once it is confirmed", async () => {
    const g = await world();
    const a = await g.call("import_document", { world_id: g.worldId, title: "a.md", entities: [{ type: "place", name: "Lys" }] });
    await g.call("confirm_import", { import_id: a.status.import_id, accepted: [0] });
    const b = await g.call("import_document", { world_id: g.worldId, title: "b.md", entities: [{ type: "place", name: "Lys" }] });
    expect(b.text).toContain("likely duplicate of **lys**");
    expect(b.text).not.toContain("also in");
  });
});

describe("M6: an established-universe skeleton stored as unverified and labeled in context", () => {
  it("labels unverified pages in get_context and read_entity until the user marks them canon", async () => {
    const g = await world();
    for (const [type, name, summary] of [
      ["place", "Braavos", "Free City of canals, home of the Iron Bank."],
      ["faction", "Iron Bank", "Braavosi bank that lends to kings."],
    ] as const) {
      const r = await g.call("create_entity", { world_id: g.worldId, type, name, source: "unverified", summary });
      expect(r.isError).toBe(false);
    }
    expect((await g.storage.getEntityBySlug(g.worldId, "iron-bank"))!.source).toBe("unverified");

    const camp = await g.call("create_campaign", { world_id: g.worldId, name: "Run 1" });
    await g.call("open_campaign", { campaign_id: camp.status.campaign_id });
    const ctx = await g.call("get_context", { campaign_id: camp.status.campaign_id, present: ["Iron Bank"], place: "Braavos" });
    expect(ctx.text).toMatch(/Iron Bank[^\n]*UNVERIFIED/);
    expect(ctx.text).toMatch(/Braavos[^\n]*UNVERIFIED/);
    const read = await g.call("read_entity", { entity: "Iron Bank" });
    expect(read.text).toContain("UNVERIFIED");

    // The user checks the Iron Bank page and marks it canon in the web app.
    const bank = (await g.storage.getEntityBySlug(g.worldId, "iron-bank"))!;
    const marked = await g.engine.userEditEntity({ entityId: bank.id, patch: { source: "canon" } });
    expect(marked.ok).toBe(true);
    const after = await g.call("get_context", { campaign_id: camp.status.campaign_id, present: ["Iron Bank"], place: "Braavos" });
    expect(after.text).not.toMatch(/Iron Bank[^\n]*UNVERIFIED/);
    expect(after.text).toMatch(/Braavos[^\n]*UNVERIFIED/);
  });
});
