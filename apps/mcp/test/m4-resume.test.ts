// Milestone 4 acceptance support: "A new chat resumes the campaign from open_campaign alone, with no save block."
// Chat 1 runs intake and two scenes; chat 2 is a fresh MCP server on the same database, like a new Claude chat.
// Everything the old save block carried must come back from one open_campaign call.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RulesEngine, SqliteStorage } from "@continuity/core";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server";

async function chat(storage: SqliteStorage) {
  const server = createServer(new RulesEngine(storage));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "chat", version: "0" });
  await client.connect(b);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    return { text: r.content[0]!.text, status: (r.content[1] ? JSON.parse(r.content[1].text) : {}) as Record<string, unknown>, isError: !!r.isError };
  };
}

describe("M4: a new chat resumes from open_campaign alone", () => {
  it("returns settings, as-of, voice anchor, PC sheet, threads, rulings and this chapter's scenes", async () => {
    const storage = SqliteStorage.open(":memory:");
    const one = await chat(storage);
    const world = await one("create_world", { name: "The Free Cities", depth: "compact", approval_mode: "autopilot" });
    const worldId = world.status.world_id as string;
    await one("create_entity", { world_id: worldId, type: "character", name: "Marro", source: "invention", summary: "A squire." });
    const campaign = await one("create_campaign", { world_id: worldId, name: "Run 1", settings: { difficulty: "balanced", lines: ["harm to children"] } });
    const campaignId = campaign.status.campaign_id as string;
    await one("open_campaign", { campaign_id: campaignId });

    // Intake: the sheet and as-of moment are stored before any scene.
    const sheet = await one("update_campaign", {
      campaign_id: campaignId,
      as_of: "Spring, year 300",
      pc_sheet: { name: "Rickard Snow", stats: { might: 2, wits: 1 }, health: 6, stress: 0, inventory: ["sword"], flaw_notes: "" },
    });
    expect(sheet.isError).toBe(false);
    expect(sheet.text).toContain("(confirmed)");
    await one("set_voice_anchor", { campaign_id: campaignId, sample: "Rain on the wall.", profile: "Clipped.", interior_level: "deep" });

    // Play: two scenes, a ruling, a settings change.
    await one("get_context", { campaign_id: campaignId, present: ["Marro"] });
    await one("log_scene", { campaign_id: campaignId, summary: "Rickard hired Marro at the gate.", present: ["Marro"], pc_changes: { stress: 1 }, thread_changes: [{ title: "Marro's debt", body: "He owes the Iron Bank." }] });
    await one("record_ruling", { campaign_id: campaignId, text: "Marro is left-handed." });
    const settings = await one("update_campaign", { campaign_id: campaignId, settings: { difficulty: "brutal" } });
    expect(settings.text).toContain("difficulty: brutal");
    await one("get_context", { campaign_id: campaignId, present: ["Marro"] });
    await one("log_scene", { campaign_id: campaignId, summary: "They crossed the Long Bridge.", present: ["Marro"] });

    // Chat 2: a fresh server, one call.
    const two = await chat(storage);
    const opened = await two("open_campaign", { campaign_id: campaignId });
    expect(opened.isError).toBe(false);
    const t = opened.text;
    expect(t).toContain("- as of: Spring, year 300");
    expect(t).toContain("- difficulty: brutal");
    expect(t).toContain("- lines: harm to children");
    expect(t).toContain("> Rain on the wall.");
    expect(t).toContain('"name": "Rickard Snow"');
    expect(t).toContain('"stress": 1');
    expect(t).toContain('"inventory": [');
    expect(t).toContain("- Marro's debt: He owes the Iron Bank.");
    expect(t).toContain('- "Marro is left-handed."');
    expect(t).toMatch(/## This chapter so far \(ch-01\)\n- Scene 1: Rickard hired Marro at the gate\.\n- Scene 2: They crossed the Long Bridge\./);
  });

  it("refuses an invalid settings change and stores nothing", async () => {
    const storage = SqliteStorage.open(":memory:");
    const one = await chat(storage);
    const world = await one("create_world", { name: "W", depth: "compact", approval_mode: "autopilot" });
    const campaign = await one("create_campaign", { world_id: world.status.world_id, name: "Run 1" });
    const campaignId = campaign.status.campaign_id as string;
    await one("open_campaign", { campaign_id: campaignId });
    const before = JSON.stringify(storage.dump());
    const empty = await one("update_campaign", { campaign_id: campaignId });
    expect(empty.isError).toBe(true);
    expect(empty.text).toMatch(/pass settings, as_of or pc_sheet/);
    const bad = await one("update_campaign", { campaign_id: campaignId, pc_sheet: { stats: "strong" } });
    expect(bad.isError).toBe(true);
    expect(JSON.stringify(storage.dump())).toBe(before);
  });
});
