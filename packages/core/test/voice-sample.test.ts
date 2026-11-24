// Voice sample (added after M8 with Parker's OK, SPEC updated): the user edits the voice anchor from campaign
// settings at any time, get_context returns it before every scene, and log_scene says when an audit is due.
import { describe, expect, it } from "vitest";
import { RulesEngine, VOICE_AUDIT_SCENES } from "../src";
import { USER, seed, setup } from "./helpers";

async function changes(engine: RulesEngine, campaignId: string) {
  const r = await engine.changelog(campaignId, { author: "user" });
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value.length;
}

async function play() {
  const base = await setup();
  await seed(base.storage, base.world.id);
  const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode: "autopilot" }, USER);
  const engine = new RulesEngine(base.storage);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  return { ...base, campaign, engine, sessionId: opened.value.session.id };
}

describe("voice sample", () => {
  it("get_context returns the voice anchor before every scene", async () => {
    const { engine, campaign, sessionId } = await play();
    const none = await engine.getContext({ sessionId, present: ["rickard-snow"] });
    if (!none.ok) throw new Error(none.refusal.message);
    expect(none.value.voiceAnchor).toBeNull();
    await engine.logScene({ sessionId, summary: "Scene 1.", present: ["rickard-snow"], updates: [] });

    await engine.editVoiceAnchor({ campaignId: campaign.id, sample: "Rain on the wall.", avoidList: ["neat endings"] });
    const ctx = await engine.getContext({ sessionId, present: ["rickard-snow"] });
    if (!ctx.ok) throw new Error(ctx.refusal.message);
    expect(ctx.value.voiceAnchor?.sampleVerbatim).toBe("Rain on the wall.");
    expect(ctx.value.voiceAnchor?.avoidList).toEqual(["neat endings"]);
  });

  it("the user can edit the anchor after play starts; rulings and the audit count are kept; one versions row per edit", async () => {
    const { engine, storage, campaign, sessionId } = await play();
    await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "Rain on the wall.", profile: "Clipped.", interiorLevel: "deep", avoidList: ["triplets"] });
    await engine.logScene({ sessionId, summary: "Scene 1.", present: ["rickard-snow"], updates: [] });
    await engine.recordRuling({ sessionId, text: "Colder.", kind: "voice" });

    // Claude can no longer replace it, but the user can.
    expect((await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "x", profile: "y", interiorLevel: "deep" })).ok).toBe(false);
    const before = await changes(engine, campaign.id);
    const r = await engine.editVoiceAnchor({ campaignId: campaign.id, sample: "  Snow, then silence.  ", avoidList: ["triplets", "", " epigrams "] });
    if (!r.ok) throw new Error(r.refusal.message);
    expect(r.value).toMatchObject({ sampleVerbatim: "Snow, then silence.", profileMd: "Clipped.", interiorLevel: "deep", avoidList: ["triplets", "epigrams"], voiceRulings: ["Colder."], scenesSinceAudit: 1 });
    expect(await changes(engine, campaign.id)).toBe(before + 1);

    // Saving the same thing again writes nothing.
    await engine.editVoiceAnchor({ campaignId: campaign.id, sample: "Snow, then silence." });
    expect(await changes(engine, campaign.id)).toBe(before + 1);
    expect((await storage.getVoiceAnchor(campaign.id))?.sampleVerbatim).toBe("Snow, then silence.");
  });

  it("refuses an empty sample and an unknown campaign", async () => {
    const { engine, campaign } = await play();
    expect(await engine.editVoiceAnchor({ campaignId: campaign.id, sample: "   " })).toMatchObject({ ok: false });
    expect(await engine.editVoiceAnchor({ campaignId: "nope", sample: "x" })).toMatchObject({ ok: false, refusal: { rule: "not_found" } });
  });

  it("log_scene flags a voice audit every few scenes", async () => {
    const { engine, campaign, sessionId } = await play();
    await engine.setVoiceAnchor({ campaignId: campaign.id, sample: "Rain on the wall.", profile: "Clipped.", interiorLevel: "deep" });
    const due: boolean[] = [];
    for (let i = 0; i < VOICE_AUDIT_SCENES * 2; i++) {
      const r = await engine.logScene({ sessionId, summary: `Scene ${i + 1}.`, present: ["rickard-snow"], updates: [] });
      if (!r.ok) throw new Error(r.refusal.message);
      due.push(r.value.voiceAuditDue);
    }
    expect(due.map((d, i) => (d ? i + 1 : 0)).filter(Boolean)).toEqual([VOICE_AUDIT_SCENES, VOICE_AUDIT_SCENES * 2]);
  });
});
