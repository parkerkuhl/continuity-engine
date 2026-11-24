// Milestone 6 acceptance (SPEC "Phase 0: building the world"), driven through the MCP server as Claude would:
//  - A compact world built entirely by interview, every page approved
//  - A multi-file world bible imported, with duplicates and disagreements flagged before confirm
//  - An established-universe skeleton stored as `unverified` and labeled in context
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RulesEngine, SqliteStorage, WebViews } from "@continuity/core";
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

describe("M6: a compact world built entirely by interview, every page approved", () => {
  it("drafts a page per interview step as proposed, stores the as-of moment, and every page is approved in the web app", async () => {
    const g = await connect();
    const w = await g.call("create_world", { name: "Saltmarch", pitch: "Drowned towns and toll-lords.", depth: "compact", approval_mode: "review" });
    const worldId = w.status.world_id as string;
    // Compact interview: one page per step (SPEC Phase 0, path A).
    const steps = [
      { type: "concept", name: "Overview", summary: "Drowned towns ruled by toll-lords. Tone: grim, wry.", sections: [{ heading: "Pillars", body: "Debt, water, family." }] },
      { type: "concept", name: "Society", summary: "Toll-lords own the bridges; everyone else pays.", sections: [] },
      { type: "place", name: "Gullhaven", summary: "The last dry harbor.", sections: [{ heading: "Districts", body: "Stilts, Dry Ward." }] },
      { type: "concept", name: "Timeline", summary: "The Flood, the Tolls, now.", sections: [] },
      { type: "faction", name: "The Tollkeepers", aliases: ["the Keepers"], summary: "They own every bridge.", sections: [{ heading: "Aims", body: "Keep the tolls." }] },
      { type: "concept", name: "Magic or Tech", summary: "Tide-reading: costs memories.", sections: [] },
      { type: "concept", name: "Glossary", summary: "Slang and oaths.", sections: [{ heading: "Oaths", body: "- *By the high water*" }] },
      { type: "character", name: "Maren Vos", summary: "Tollkeeper heir with a secret debt.", sections: [{ heading: "Debt", body: "She owes the smugglers.", visibility: "secret" }] },
    ];
    const ids: string[] = [];
    for (const s of steps) {
      const r = await g.call("create_entity", { world_id: worldId, source: "invention", ...s });
      expect(r.isError).toBe(false);
      expect(r.status.status).toBe("proposed");
      expect(r.text).toMatch(/Stored as \*\*proposed\*\*.*until the user approves it/);
      ids.push(r.status.entity_id as string);
    }
    // The user asks for a change mid-interview; the page stays a draft.
    const edit = await g.call("edit_entity", { world_id: worldId, entity: "gullhaven", summary: "The last dry harbor, on stilts." });
    expect(edit.isError).toBe(false);
    expect(edit.status.status).toBe("proposed");
    // Step 9: the as-of moment, on the world.
    const asOf = await g.call("update_world", { world_id: worldId, as_of: "First week of the dry season" });
    expect(asOf.text).toMatch(/As of: First week of the dry season/);
    expect((await g.call("list_worlds")).text).toMatch(/As of: First week of the dry season/);

    // The web app's review queue lists every draft; the user approves each one.
    const views = new WebViews(g.engine);
    const scope = (await views.scope({ worldId }))!;
    expect((await views.pageQueue(scope)).length).toBe(steps.length);
    for (const id of ids) expect((await g.engine.approvePage(id)).ok).toBe(true);
    expect(await views.pageQueue(scope)).toEqual([]);
    const pages = await g.storage.listEntities(worldId);
    expect(pages).toHaveLength(steps.length);
    expect(pages.every((p) => p.status === "confirmed")).toBe(true);

    // A campaign starts at the world's as-of moment, and the GM sees the pages unlabeled.
    const camp = await g.call("create_campaign", { world_id: worldId, name: "First run" });
    const campaignId = camp.status.campaign_id as string;
    const opened = await g.call("open_campaign", { campaign_id: campaignId });
    expect(opened.text).toMatch(/as of: First week of the dry season/);
    const ctx = await g.call("get_context", { campaign_id: campaignId, present: ["maren-vos"], place: "gullhaven" });
    expect(ctx.text).not.toMatch(/PROPOSED/);
  });

  it("labels a draft page PROPOSED in what the GM reads until it is approved", async () => {
    const g = await connect();
    const w = await g.call("create_world", { name: "Saltmarch", depth: "compact", approval_mode: "batch" });
    const worldId = w.status.world_id as string;
    await g.call("create_entity", { world_id: worldId, type: "place", name: "Gullhaven", source: "invention", summary: "Harbor." });
    const camp = await g.call("create_campaign", { world_id: worldId, name: "Run" });
    const campaignId = camp.status.campaign_id as string;
    await g.call("open_campaign", { campaign_id: campaignId });
    const read = await g.call("read_entity", { campaign_id: campaignId, entity: "gullhaven" });
    expect(read.text).toMatch(/PROPOSED page: drafted by the GM, not yet approved/);
    expect(read.text).toMatch(/PROPOSED PAGE/);
  });
});

describe("M6: log_scene secrets_learned", () => {
  it("records that the PC learned a secret section, and read_entity's player view then shows it", async () => {
    const g = await connect();
    const w = await g.call("create_world", { name: "Saltmarch", depth: "compact", approval_mode: "autopilot" });
    const worldId = w.status.world_id as string;
    await g.call("create_entity", { world_id: worldId, type: "character", name: "Maren Vos", source: "invention", sections: [{ heading: "Debt", body: "She owes the smugglers.", visibility: "secret" }] });
    await g.call("create_entity", { world_id: worldId, type: "character", name: "Asha Reed", source: "invention" });
    const camp = await g.call("create_campaign", { world_id: worldId, name: "Run" });
    const campaignId = camp.status.campaign_id as string;
    await g.call("open_campaign", { campaign_id: campaignId });
    await g.call("update_campaign", { campaign_id: campaignId, pc_sheet: { name: "Asha Reed" } });
    await g.call("get_context", { campaign_id: campaignId, present: ["maren-vos", "asha-reed"] });
    const player = async () => (await g.call("read_entity", { campaign_id: campaignId, entity: "maren-vos", view: "player" })).text;
    expect(await player()).not.toMatch(/smugglers/);
    const logged = await g.call("log_scene", {
      campaign_id: campaignId,
      summary: "Maren admits the debt.",
      present: ["maren-vos", "asha-reed"],
      secrets_learned: [{ entity: "maren-vos", section: "debt", by: ["asha-reed"] }],
    });
    expect(logged.isError).toBe(false);
    expect(logged.text).toMatch(/"Debt" of Maren Vos: now known by Asha Reed/);
    expect(await player()).toMatch(/smugglers/);
  });
});
