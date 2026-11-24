// UX review #1: a GM page edit during play respects who knows (edit_entity `knows`).
import { describe, expect, it } from "vitest";
import { RulesEngine, WebViews } from "../src";
import { AI, USER, seed, setup } from "./helpers";

async function game() {
  const base = await setup();
  await seed(base.storage, base.world.id);
  const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode: "autopilot" }, USER);
  await base.storage.createEntity({ worldId: base.world.id, campaignId: campaign.id, type: "character", name: "Asha Reed", source: "invention", summary: "The PC." }, AI);
  await base.storage.setPcSheet({ campaignId: campaign.id, data: { name: "Asha Reed" } }, USER);
  const engine = new RulesEngine(base.storage);
  const views = new WebViews(engine);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  const sessionId = opened.value.session.id;
  const ctx = await engine.getContext({ sessionId, present: ["rickard-snow", "asha-reed"] });
  if (!ctx.ok) throw new Error(ctx.refusal.message);
  const scope = async () => (await views.scope({ worldId: base.world.id, campaignId: campaign.id }))!;
  return { ...base, campaign, engine, views, scope, sessionId };
}

const wants = "Land of his own, and revenge on the paymaster who shorted the Company.";

describe("UX #1: edit_entity during play respects who knows", () => {
  it("keeps a fact the PC doesn't know out of the player view until the PC learns it", async () => {
    const g = await game();
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: wants }], knows: ["Rickard Snow"] });
    expect(r.ok).toBe(true);

    await g.engine.setSpoilers(g.campaign.id, false);
    let page = (await g.views.entity(await g.scope(), "rickard-snow"))!.page;
    expect(page.sections.find((s) => s.key === "wants")!.bodyMd).toContain("Pay the company before winter.");
    expect(page.sections.some((s) => s.bodyMd === wants)).toBe(false);

    await g.engine.setSpoilers(g.campaign.id, true);
    page = (await g.views.entity(await g.scope(), "rickard-snow"))!.page;
    const secret = page.sections.find((s) => s.key === "wants-secret")!;
    expect(secret).toMatchObject({ heading: "Wants (secret)", visibility: "secret", bodyMd: wants, campaignId: g.campaign.id });

    // The PC learns it in a later scene: now the player view shows it.
    const logged = await g.engine.logScene({ sessionId: g.sessionId, summary: "Rickard tells Asha.", present: ["rickard-snow", "asha-reed"], updates: [], secretsLearned: [{ entity: "rickard-snow", section: "wants-secret", by: ["asha-reed"] }] });
    expect(logged.ok).toBe(true);
    await g.engine.setSpoilers(g.campaign.id, false);
    page = (await g.views.entity(await g.scope(), "rickard-snow"))!.page;
    expect(page.sections.find((s) => s.key === "wants-secret")?.bodyMd).toBe(wants);
  });

  it("edits the public section as before when the PC is among those who know", async () => {
    const g = await game();
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: wants }], knows: ["rickard-snow", "asha-reed"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sections.find((s) => s.key === "wants")!.bodyMd).toBe(wants);
  });

  it("refuses a summary change the PC doesn't know", async () => {
    const g = await game();
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", summary: "Secretly broke.", knows: ["rickard-snow"] });
    expect(r.ok).toBe(false);
  });
});
