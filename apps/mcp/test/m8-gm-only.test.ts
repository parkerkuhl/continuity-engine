// Milestone 7 follow-up, fixed in M8 with Parker's OK: get_context and read_entity put updates the PC
// doesn't know (SPEC "Spoiler model": updates whose `knows` list excludes the PC) in the GM ONLY block.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RulesEngine, SqliteStorage } from "@continuity/core";
import { describe, expect, it } from "vitest";
import { GM_ONLY } from "../src/render";
import { createServer } from "../src/server";

async function game(pc: string | null) {
  const server = createServer(new RulesEngine(SqliteStorage.open(":memory:")));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    if (r.isError) throw new Error(r.content[0]!.text);
    return { text: r.content[0]!.text, status: JSON.parse(r.content[1]!.text) as Record<string, unknown> };
  };
  const w = await call("create_world", { name: "The Free Cities", depth: "compact", approval_mode: "autopilot" });
  const worldId = w.status.world_id as string;
  await call("create_entity", { world_id: worldId, type: "character", name: "Rickard Snow", source: "invention", summary: "Sellsword captain." });
  await call("create_entity", { world_id: worldId, type: "character", name: "Hesse", source: "invention", summary: "A Maegyr cousin." });
  const c = await call("create_campaign", { world_id: worldId, name: "Run" });
  const campaignId = c.status.campaign_id as string;
  await call("open_campaign", { campaign_id: campaignId });
  if (pc) await call("update_campaign", { campaign_id: campaignId, pc_sheet: { name: pc } });
  await call("get_context", { campaign_id: campaignId, present: ["Rickard Snow", "Hesse"] });
  await call("log_scene", {
    campaign_id: campaignId,
    summary: "Dinner at the Maegyr house.",
    present: ["Rickard Snow", "Hesse"],
    updates: [
      { entities: ["Hesse"], type: "new-fact", severity: "minor", body: "Hesse pours the wine herself.", knows: ["Rickard Snow", "Hesse"] },
      { entities: ["Hesse"], type: "new-fact", severity: "minor", body: "Hesse has poisoned the second cup.", knows: ["Hesse"] },
    ],
  });
  return { call, campaignId };
}

const split = (text: string) => {
  const at = text.indexOf(GM_ONLY);
  return at < 0 ? { open: text, gm: "" } : { open: text.slice(0, at), gm: text.slice(at) };
};

describe("M8: updates the PC doesn't know stay in the GM ONLY block", () => {
  it("get_context puts them, and what an NPC knows that the PC doesn't, after GM ONLY", async () => {
    const g = await game("Rickard Snow");
    const ctx = await g.call("get_context", { campaign_id: g.campaignId, present: ["Hesse"] });
    const { open, gm } = split(ctx.text);
    expect(open).toContain("Hesse pours the wine herself.");
    expect(open).not.toContain("poisoned");
    expect(gm).toContain("Hesse has poisoned the second cup.");
    expect(gm).toContain("Hesse knows (the PC doesn't)");
  });

  it("read_entity in the GM view does the same", async () => {
    const g = await game("Rickard Snow");
    const r = await g.call("read_entity", { campaign_id: g.campaignId, entity: "Hesse" });
    const { open, gm } = split(r.text);
    expect(open).toContain("Hesse pours the wine herself.");
    expect(open).not.toContain("poisoned");
    expect(gm).toContain("Hesse has poisoned the second cup.");
  });

  it("with no PC on the sheet, updates aren't treated as secret", async () => {
    const g = await game(null);
    const ctx = await g.call("get_context", { campaign_id: g.campaignId, present: ["Hesse"] });
    expect(split(ctx.text).open).toContain("Hesse has poisoned the second cup.");
  });
});
