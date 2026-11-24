// Milestone 4 support: the play module audits the voice every few scenes and at every chapter opening,
// so close_chapter reports whether an audit is due and then restarts the scene count.
import { describe, expect, it } from "vitest";
import { RulesEngine, VOICE_AUDIT_EVERY } from "../src";
import { USER, seed, setup } from "./helpers";

describe("voice audit count", () => {
  it("close_chapter reports the count and resets it for the next chapter", async () => {
    const base = await setup();
    await seed(base.storage, base.world.id);
    const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode: "autopilot" }, USER);
    const engine = new RulesEngine(base.storage);
    const opened = await engine.openCampaign(campaign.id);
    if (!opened.ok) throw new Error(opened.refusal.message);
    const sessionId = opened.value.session.id;
    const anchor = await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "Rain on the wall.", profile: "Clipped.", interiorLevel: "deep" });
    expect(anchor.ok).toBe(true);

    for (let i = 0; i < VOICE_AUDIT_EVERY; i++) await engine.logScene({ sessionId, summary: `Scene ${i + 1}.`, present: ["rickard-snow"], updates: [] });
    const first = await engine.closeChapter({ sessionId, title: "One", summary: "It began." });
    if (!first.ok) throw new Error(first.refusal.message);
    expect(first.value.voiceAuditDue).toBe(true);
    expect(first.value.scenesSinceAudit).toBe(VOICE_AUDIT_EVERY);

    await engine.logScene({ sessionId, summary: "Scene 7.", present: ["rickard-snow"], updates: [] });
    const second = await engine.closeChapter({ sessionId, title: "Two", summary: "It went on." });
    if (!second.ok) throw new Error(second.refusal.message);
    expect(second.value.voiceAuditDue).toBe(false);
    expect(second.value.scenesSinceAudit).toBe(1);
  });
});
