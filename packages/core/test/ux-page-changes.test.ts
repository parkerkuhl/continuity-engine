// UX review #3 and #4: who last changed each section, and the GM's page edits during play waiting for review.
import { describe, expect, it } from "vitest";
import { RulesEngine, WebViews } from "../src";
import { USER, seed, setup } from "./helpers";

async function game() {
  const base = await setup();
  const ents = await seed(base.storage, base.world.id);
  const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode: "autopilot" }, USER);
  const engine = new RulesEngine(base.storage);
  const views = new WebViews(engine);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  const sessionId = opened.value.session.id;
  const scope = async () => (await views.scope({ worldId: base.world.id, campaignId: campaign.id }))!;
  const ctx = await engine.getContext({ sessionId, present: ["rickard-snow"] });
  if (!ctx.ok) throw new Error(ctx.refusal.message);
  return { ...base, ...ents, campaign, engine, views, scope, sessionId };
}

describe("UX #3/#4: provenance and page changes from play", () => {
  it("labels a GM section edit with its scene and lists it until kept or undone", async () => {
    const g = await game();
    const ai = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: "Land of his own, and the Company paid." }] });
    expect(ai.ok).toBe(true);

    const view = (await g.views.entity(await g.scope(), "rickard-snow"))!;
    const wants = view.page.sections.find((s) => s.key === "wants")!;
    expect(wants.latest?.author).toBe("ai");
    expect(wants.latest?.scene).toEqual({ chapter: 1, number: 1 });
    expect(view.history.find((h) => h.id === wants.latest!.versionId)?.scene).toEqual({ chapter: 1, number: 1 });

    const changes = await g.views.pageChanges(await g.scope());
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ heading: "Wants", after: "Land of his own, and the Company paid.", entity: { slug: "rickard-snow" } });
    expect(changes[0]!.before).toContain("Pay the company before winter.");

    // Keep: the version id goes in the kept list and the row leaves.
    expect(await g.views.pageChanges(await g.scope(), { kept: changes[0]!.versionIds })).toHaveLength(0);
    // Reviewed up to now: nothing older shows.
    expect(await g.views.pageChanges(await g.scope(), { since: new Date(Date.now() + 1000).toISOString() })).toHaveLength(0);

    // Undo: restoring the text from before makes the user's version the newest, so the row leaves.
    const undo = await g.engine.restoreVersion(changes[0]!.undoVersionId, "retcon", "before");
    expect(undo.ok).toBe(true);
    expect(await g.views.pageChanges(await g.scope())).toHaveLength(0);
    const after = (await g.views.entity(await g.scope(), "rickard-snow"))!.page.sections.find((s) => s.key === "wants")!;
    expect(after.bodyMd).toContain("Pay the company before winter.");
    expect(after.latest?.author).toBe("user");
  });

  it("leaves out a secret section's edit in player view", async () => {
    const g = await game();
    await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "hiding", body: "His mother was a Targaryen bastard." }] });
    await g.engine.setSpoilers(g.campaign.id, false);
    expect(await g.views.pageChanges(await g.scope())).toHaveLength(0);
    await g.engine.setSpoilers(g.campaign.id, true);
    expect(await g.views.pageChanges(await g.scope())).toHaveLength(1);
  });
});
