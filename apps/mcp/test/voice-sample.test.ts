// Voice sample: get_context carries the sample, log_scene flags the audit, and a user edit shows in open_campaign.
import { describe, expect, it } from "vitest";
import { RulesEngine, SqliteStorage, VOICE_AUDIT_SCENES } from "@continuity/core";
import { renderContext, renderLogged, renderOpened } from "../src/render";

async function setup() {
  const storage = SqliteStorage.open(":memory:");
  const user = await storage.createUser({ name: "P" }, { author: "user" });
  const world = await storage.createWorld({ ownerId: user.id, name: "W", pitch: "", depth: "compact", defaultApprovalMode: "autopilot" }, { author: "user" });
  await storage.createEntity({ worldId: world.id, type: "character", name: "Ana", aliases: [], summary: "A guard.", source: "invention", sections: [] }, { author: "user" });
  const campaign = await storage.createCampaign({ worldId: world.id, ownerId: user.id, name: "C", approvalMode: "autopilot" }, { author: "user" });
  const engine = new RulesEngine(storage);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  return { engine, campaign, sessionId: opened.value.session.id };
}

describe("voice sample in MCP results", () => {
  it("get_context shows the sample, avoid list and voice rulings", async () => {
    const { engine, campaign, sessionId } = await setup();
    await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "Rain on the wall.\nThen nothing.", profile: "Clipped.", interiorLevel: "deep", avoidList: ["triplets"] });
    await engine.recordRuling({ sessionId, text: "Colder.", kind: "voice" });
    const r = await engine.getContext({ sessionId, present: ["ana"] });
    if (!r.ok) throw new Error(r.refusal.message);
    const text = renderContext(r.value);
    expect(text).toContain("## Voice (check this scene's prose against the sample)");
    expect(text).toContain("> Rain on the wall.\n> Then nothing.");
    expect(text).toContain("Avoid: triplets");
    expect(text).toContain('- "Colder."');
  });

  it("log_scene says when a voice audit is due", async () => {
    const { engine, campaign, sessionId } = await setup();
    await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "Rain.", profile: "", interiorLevel: "deep" });
    let last = "";
    for (let i = 0; i < VOICE_AUDIT_SCENES; i++) {
      const r = await engine.logScene({ sessionId, summary: `S${i}`, present: ["ana"], updates: [] });
      if (!r.ok) throw new Error(r.refusal.message);
      last = renderLogged(r.value);
      if (i < VOICE_AUDIT_SCENES - 1) expect(last).not.toContain("Voice audit due");
    }
    expect(last).toContain("Voice audit due");
  });

  it("a user edit of the voice shows in the next open_campaign change feed", async () => {
    const { engine, campaign } = await setup();
    await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "Rain.", profile: "", interiorLevel: "deep" });
    await engine.editVoiceAnchor({ campaignId: campaign.id, sample: "Snow, then silence.", avoidList: ["epigrams"] });
    const o = await engine.openCampaign(campaign.id);
    if (!o.ok) throw new Error(o.refusal.message);
    const text = renderOpened(o.value, "");
    expect(text).toContain("voice anchor (write against the new version from the next turn)");
    expect(text).toContain("sampleVerbatim: Snow, then silence.");
    expect(text).toContain("avoidList: epigrams");
  });
});
