// Milestone 3 acceptance:
//  - From Claude Desktop: create a world and entities, open a campaign, get context, log a scene
//  - A refusal (unread entity, locked section, unknown alias) shows Claude a message that says how to fix it
// These tests drive the real MCP server through an MCP client, the same protocol Claude Desktop speaks:
// in memory for speed, and once over stdio against the built bundle.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RulesEngine, SqliteStorage } from "@continuity/core";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server";

const SPEC_TOOLS = [
  "list_worlds",
  "create_world",
  "create_entity",
  "edit_entity",
  "import_document",
  "confirm_import",
  "create_campaign",
  "set_voice_anchor",
  "open_campaign",
  "get_context",
  "read_entity",
  "search_wiki",
  "log_scene",
  "close_chapter",
  "record_ruling",
  "gm_read",
  "gm_write",
];

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
  return { client, call, engine, storage };
}

/** The acceptance flow, step by step, as Claude would run it. */
async function playthrough() {
  const c = await connect();
  const world = await c.call("create_world", { name: "The Free Cities", pitch: "Sellswords and old debts.", depth: "compact", approval_mode: "mixed" });
  const worldId = world.status.world_id as string;
  const rickard = await c.call("create_entity", {
    world_id: worldId,
    type: "character",
    name: "Rickard Snow",
    aliases: ["Snow", "the bastard sellsword"],
    source: "invention",
    summary: "Sellsword captain outside Volantis.",
    sections: [
      { heading: "Appearance", body: "Tall, grey-eyed." },
      { heading: "Hiding", body: "His mother's name.", visibility: "secret" },
    ],
  });
  await c.call("create_entity", { world_id: worldId, type: "character", name: "Marro", aliases: ["the squire"], source: "invention", summary: "Rickard's squire." });
  await c.call("create_entity", { world_id: worldId, type: "place", name: "Volantis", aliases: ["Old Volantis"], source: "canon", summary: "The oldest Free City." });
  const campaign = await c.call("create_campaign", { world_id: worldId, name: "Run 1", settings: { genre: "low fantasy", tone: "grim" } });
  const campaignId = campaign.status.campaign_id as string;
  return { ...c, worldId, campaignId, rickardId: rickard.status.entity_id as string, results: { world, rickard, campaign } };
}

describe("M3: the server exposes every tool in the spec", () => {
  it("lists all 17 tools, each with a description and a JSON schema generated from Zod", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...SPEC_TOOLS].sort());
    for (const t of tools) {
      expect(t.description!.length, t.name).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe("object");
    }
    const log = tools.find((t) => t.name === "log_scene")!;
    expect(Object.keys(log.inputSchema.properties!)).toEqual(
      expect.arrayContaining(["campaign_id", "summary", "present", "place", "updates", "thread_changes", "pc_changes"]),
    );
  });
});

describe("M3 acceptance: create a world and entities, open a campaign, get context, log a scene", () => {
  it("runs the whole flow, and every write says what was stored and its status", async () => {
    const g = await playthrough();
    expect(g.results.world.text).toMatch(/World "The Free Cities" created/);
    expect(g.results.rickard.text).toMatch(/Stored as \*\*confirmed\*\*/);
    expect(g.results.rickard.status).toMatchObject({ slug: "rickard-snow", status: "confirmed" });

    const listed = await g.call("list_worlds");
    expect(listed.text).toContain(`Campaign "Run 1" (campaign_id: ${g.campaignId})`);

    const opened = await g.call("open_campaign", { campaign_id: g.campaignId });
    expect(opened.isError).toBe(false);
    expect(opened.text).toMatch(/Session open\. Chapter 1\. Approval: mixed \(minor: autopilot, major: batch\)/);
    expect(opened.text).toContain("Nothing changed since the last session.");
    expect(opened.text).toContain("- [Rickard Snow](characters/rickard-snow.md)"); // pinned load guide

    const ctx = await g.call("get_context", { campaign_id: g.campaignId, present: ["the bastard sellsword", "the squire"], place: "Old Volantis" });
    expect(ctx.isError).toBe(false);
    expect(ctx.status.read).toEqual(["volantis", "rickard-snow", "marro"]);
    expect(ctx.text).toContain("## Rickard Snow (character, rickard-snow)");
    // secrets come last, in the GM ONLY block
    const gmAt = ctx.text.indexOf("## GM ONLY");
    expect(gmAt).toBeGreaterThan(ctx.text.indexOf("## Marro"));
    expect(ctx.text.slice(gmAt)).toContain("His mother's name.");
    expect(ctx.text.slice(0, gmAt)).not.toContain("His mother's name.");

    const logged = await g.call("log_scene", {
      campaign_id: g.campaignId,
      summary: "The retreat from the walls.",
      present: ["Rickard Snow", "Marro"],
      place: "Volantis",
      updates: [
        { entities: ["Snow"], tags: ["volantis", "ch-01"], type: "status-change", severity: "minor", body: "Bolt to the left shoulder.", knows: ["Marro"] },
        { entities: ["marro"], tags: ["ch-01"], type: "death", severity: "minor", body: "Marro died covering the retreat." },
      ],
      thread_changes: [{ title: "Who fired the bolt?" }],
    });
    expect(logged.isError).toBe(false);
    expect(logged.text).toContain("Scene ch-01-s1 logged");
    expect(logged.text).toMatch(/Update 1 → #1 stored as \*\*confirmed\*\*/);
    expect(logged.text).toMatch(/Update 2 → #2 stored as \*\*proposed\*\* \(severity forced to major\)/);
    expect(logged.text).toContain("Tags: volantis (place), ch-01 (time)");
    expect(logged.status.updates).toEqual([
      { seq: 1, status: "confirmed" },
      { seq: 2, status: "proposed" },
    ]);

    // a new chat resumes from open_campaign alone
    const again = await g.call("open_campaign", { campaign_id: g.campaignId });
    expect(again.text).toContain("Who fired the bolt?");
    expect(again.status.unlogged_scene).toBeNull();
  });

  it("covers the rest of the tools: read, search, edit, ruling, voice, GM notes, chapter close, import", async () => {
    const g = await playthrough();
    const voice = await g.call("set_voice_anchor", { campaign_id: g.campaignId, sample: "The rain came sideways.", profile: "Terse, close third.", interior_level: "medium" });
    expect(voice.text).toContain("Voice anchor stored");
    await g.call("open_campaign", { campaign_id: g.campaignId });

    const player = await g.call("read_entity", { entity: "Snow", view: "player" });
    expect(player.text).not.toContain("His mother's name.");
    expect(player.text).toContain("Player view");
    const gm = await g.call("read_entity", { entity: "Snow" });
    expect(gm.text).toContain("## GM ONLY");

    expect((await g.call("search_wiki", { query: "grey-eyed" })).status.matches).toEqual(["rickard-snow"]);
    expect((await g.call("search_wiki", { query: "mother", view: "player" })).status.matches).toEqual([]);
    expect((await g.call("search_wiki", { query: "mother" })).status.matches).toEqual(["rickard-snow"]);

    const edit = await g.call("edit_entity", { entity: "rickard-snow", summary: "Wounded sellsword captain.", sections: [{ key: "appearance", body: "Tall, grey-eyed, pale." }] });
    expect(edit.text).toContain("logged in the changelog");

    expect((await g.call("record_ruling", { campaign_id: g.campaignId, text: "No resurrection in this world." })).text).toContain("No resurrection");
    expect((await g.call("record_ruling", { campaign_id: g.campaignId, text: "Less weather.", kind: "voice" })).isError).toBe(false);

    expect((await g.call("gm_write", { campaign_id: g.campaignId, kind: "clock", key: "siege", body: "The siege tightens.", data: { step: 1, steps: 6, advances_on: "each retreat" } })).isError).toBe(false);
    expect((await g.call("gm_write", { campaign_id: g.campaignId, kind: "clock", key: "bad", body: "", data: { step: 9, steps: 6, advances_on: "x" } })).text).toMatch(/between 0 and 6/);
    expect((await g.call("gm_read", { campaign_id: g.campaignId })).text).toMatch(/GM ONLY[\s\S]*clock: siege/);

    await g.call("get_context", { campaign_id: g.campaignId, present: ["rickard-snow"] });
    await g.call("log_scene", { campaign_id: g.campaignId, summary: "x", present: ["rickard-snow"], updates: [{ entities: ["rickard-snow"], type: "item", severity: "minor", body: "Lost his sword." }] });
    const closed = await g.call("close_chapter", { campaign_id: g.campaignId, title: "The Walls", summary: "They fell back." });
    expect(closed.text).toContain("- [ ] rickard-snow (1 update(s) this chapter)");
    expect(closed.text).toContain("- [ ] siege: step 1/6");
    expect((await g.call("open_campaign", { campaign_id: g.campaignId })).text).toContain("Chapter 2.");

    // voice anchor is intake-only once play has started
    const late = await g.call("set_voice_anchor", { campaign_id: g.campaignId, sample: "x", profile: "y", interior_level: "low" });
    expect(late).toMatchObject({ isError: true });
    expect(late.text).toContain('record_ruling (kind "voice")');

    const imp = await g.call("import_document", {
      world_id: g.worldId,
      title: "bible.md",
      entities: [
        { type: "place", name: "Old Volantis", summary: "A city of black walls." },
        { type: "faction", name: "Golden Company", summary: "Sellswords." },
      ],
    });
    expect(imp.text).toContain("likely duplicate of **volantis**");
    expect(imp.text).toContain('wiki says "The oldest Free City.", file says "A city of black walls."');
    expect(await g.storage.getEntityBySlug(g.worldId, "golden-company")).toBeNull(); // nothing written yet
    const conf = await g.call("confirm_import", { import_id: imp.status.import_id, accepted: [1] });
    expect(conf.text).toContain("Golden Company (golden-company");
    expect((await g.storage.getEntityBySlug(g.worldId, "golden-company"))!.source).toBe("canon");
  });
});

describe("M3 acceptance: refusals tell Claude how to fix the call", () => {
  it("unread entity: names the entity and the tool to read it with", async () => {
    const g = await playthrough();
    await g.call("open_campaign", { campaign_id: g.campaignId });
    const r = await g.call("edit_entity", { entity: "Snow", sections: [{ key: "appearance", body: "Short." }] });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Refused \(read_before_write\)\.\*\* Read rickard-snow before writing to it: call read_entity\("rickard-snow"\) or include it in get_context, then retry\./);

    const logged = await g.call("log_scene", { campaign_id: g.campaignId, summary: "x", present: ["Marro"], updates: [{ entities: ["marro"], type: "new-fact", severity: "minor", body: "y" }] });
    expect(logged.text).toMatch(/Update 1 \*\*refused \(read_before_write\)\*\*: Read marro before writing/);
    expect(logged.text).toContain("Fix the refused updates and log them again");
  });

  it("locked section: says it is locked and how to propose the change instead", async () => {
    const g = await playthrough();
    await g.engine.userEditSection({ entityId: g.rickardId, key: "appearance", body: "Short and fair.", editKind: "retcon" });
    await g.call("open_campaign", { campaign_id: g.campaignId });
    await g.call("read_entity", { entity: "rickard-snow" });
    const r = await g.call("edit_entity", { entity: "rickard-snow", sections: [{ key: "appearance", body: "Tall." }] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Refused (locked_by_user)");
    expect(r.text).toContain('log an update with proposes_section {entity: "rickard-snow", key: "appearance"}');
    expect(r.status).toMatchObject({ ok: false, rule: "locked_by_user" });
  });

  it("unknown alias: lists the closest matches and never creates anything", async () => {
    const g = await playthrough();
    await g.call("open_campaign", { campaign_id: g.campaignId });
    const r = await g.call("get_context", { campaign_id: g.campaignId, present: ["Rikard Snow"] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('No entity called "Rikard Snow". Closest matches: rickard-snow. Use one of these, or create the entity first.');
    expect((await g.storage.listEntities(g.worldId)).map((e) => e.slug)).not.toContain("rikard-snow");

    const tag = await g.call("log_scene", { campaign_id: g.campaignId, summary: "x", present: [], updates: [{ tags: ["braavos"], type: "new-fact", severity: "minor", body: "y" }] });
    expect(tag.text).toContain("Free-form tags aren't supported yet");
  });

  it("calling a play tool before open_campaign says to open it first", async () => {
    const g = await playthrough();
    const r = await g.call("get_context", { campaign_id: g.campaignId, present: ["Snow"] });
    expect(r.text).toContain("Call open_campaign with this campaign_id first");
  });

  it("a duplicate name returns the existing entity", async () => {
    const g = await playthrough();
    const r = await g.call("create_entity", { world_id: g.worldId, type: "character", name: "Bastard Sellsword", aliases: ["Snow"], source: "invention" });
    expect(r.text).toContain('"Snow" already names rickard-snow (Rickard Snow)');
  });
});

describe("M3: stdio transport (what Claude Desktop launches)", () => {
  const appDir = fileURLToPath(new URL("..", import.meta.url));
  beforeAll(() => {
    execFileSync(process.execPath, ["build.mjs"], { cwd: appDir, stdio: "ignore" });
  });

  it("the built server starts over stdio, lists the tools and persists to CONTINUITY_DB", async () => {
    const db = join(mkdtempSync(join(tmpdir(), "ce-mcp-")), "test.db");
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(appDir, "dist/bin/server.js")], env: { ...process.env, CONTINUITY_DB: db } as Record<string, string>, stderr: "ignore" });
    const client = new Client({ name: "stdio-test", version: "0" });
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(SPEC_TOOLS.length);
    const r = (await client.callTool({ name: "create_world", arguments: { name: "Stdio World", depth: "full", approval_mode: "review" } })) as { content: { text: string }[] };
    expect(r.content[0]!.text).toContain('World "Stdio World" created');
    await client.close();

    const reopened = SqliteStorage.open(db);
    expect((await reopened.listWorlds()).map((w) => w.name)).toEqual(["Stdio World"]);
    reopened.close();
  });
});
