// Milestone 5 acceptance, at the level the web app's server actions call (RulesEngine user methods
// and WebViews). The browser test in apps/web/e2e drives the same checks through the real screens.
//  - Editing a section locks it, and an AI write to it is then refused
//  - A user edit appears in the next open_campaign change feed with its edit kind
//  - Approving in the review queue flips the update to confirmed; restore from history works
//  - Spoiler toggle off hides secret sections, gm/ notes, and updates the PC doesn't know
import { describe, expect, it } from "vitest";
import { RulesEngine, WebViews, type UpdateInput } from "../src";
import { USER, seed, setup } from "./helpers";

async function game(approvalMode: "review" | "autopilot" = "autopilot") {
  const base = await setup();
  const ents = await seed(base.storage, base.world.id);
  const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode }, USER);
  const engine = new RulesEngine(base.storage);
  const views = new WebViews(engine);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  const scope = async () => (await views.scope({ worldId: base.world.id, campaignId: campaign.id }))!;
  return { ...base, ...ents, campaign, engine, views, scope, sessionId: opened.value.session.id };
}

const fact = (over: Partial<UpdateInput> = {}): UpdateInput => ({
  entities: ["rickard-snow"],
  tags: ["ch-01"],
  type: "status-change",
  severity: "minor",
  body: "Rickard took a crossbow bolt to the left shoulder.",
  ...over,
});

describe("M5: editing a section locks it, and an AI write to it is then refused", () => {
  it("locks on save and refuses edit_entity on that section", async () => {
    const g = await game();
    const wants = g.rickard.sections.find((s) => s.key === "wants")!;
    expect(wants.lockedByUser).toBe(false);

    const edited = await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A keep by the sea.", editKind: "forward" });
    expect(edited.ok && edited.value.lockedByUser).toBe(true);
    const view = await g.views.entity(await g.scope(), "rickard-snow");
    expect(view!.page.sections.find((s) => s.key === "wants")!.lockedByUser).toBe(true);

    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const ai = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: "Gold." }] });
    expect(ai.ok).toBe(false);
    if (!ai.ok) expect(ai.refusal.rule).toBe("locked_by_user");
    const after = await g.storage.getPage(g.rickard.id);
    expect(after!.sections.find((s) => s.key === "wants")!.bodyMd).toBe("A keep by the sea.");
  });

  it("asks for an edit kind before saving a change to what a section says", async () => {
    const g = await game();
    const r = await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "Nothing." });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.rule).toBe("edit_kind_required");
  });
});

describe("M5: a user edit appears in the next open_campaign change feed with its edit kind", () => {
  it("reports a retcon and a forward change, grouped by entity", async () => {
    const g = await game();
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A keep by the sea.", editKind: "retcon" });
    await g.engine.userEditEntity({ entityId: g.volantis.id, patch: { summary: "Under siege." }, editKind: "forward" });
    const next = await g.engine.openCampaign(g.campaign.id);
    if (!next.ok) throw new Error();
    const byEntity = Object.fromEntries(next.value.changes.map((grp) => [grp.entity?.slug, grp.changes.map((v) => v.editKind)]));
    expect(byEntity["rickard-snow"]).toEqual(["retcon"]);
    expect(byEntity["volantis"]).toEqual(["forward"]);
  });
});

describe("M5: approving in the review queue flips the update to confirmed; restore from history works", () => {
  it("approve, edit, reject, and bulk-approve minor updates", async () => {
    const g = await game("review");
    await g.engine.setSpoilers(g.campaign.id, true); // no PC yet, so the player view would hide every update
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const logged = await g.engine.logScene({
      sessionId: g.sessionId,
      summary: "A skirmish.",
      present: ["rickard-snow"],
      updates: [fact(), fact({ body: "Rickard lost his purse." }), fact({ body: "Rickard swore an oath.", severity: "major" }), fact({ body: "A typo update." })],
    });
    if (!logged.ok) throw new Error(logged.refusal.message);
    const queue = (await g.views.reviewQueue(await g.scope())).items;
    expect(queue.map((i) => i.update.status)).toEqual(["proposed", "proposed", "proposed", "proposed"]);
    const [first, second, major, typo] = queue.map((i) => i.update);

    const approved = await g.engine.approveUpdate(first!.id);
    expect(approved.ok && approved.value.status).toBe("confirmed");

    const edited = await g.engine.userEditUpdate(second!.id, { body: "Rickard lost his purse and his ring." });
    expect(edited.ok && edited.value.bodyMd).toBe("Rickard lost his purse and his ring.");
    await g.engine.setUpdateStatus(typo!.id, "rejected");

    const bulk = await g.views.approveVisibleMinor(await g.scope());
    expect(bulk.map((u) => u.id)).toEqual([second!.id]);
    const left = (await g.views.reviewQueue(await g.scope())).items.map((i) => i.update.id);
    expect(left).toEqual([major!.id]); // major updates are never bulk-approved
  });

  it("restores a section to an earlier version, as a new version that is itself a user edit", async () => {
    const g = await game();
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A keep by the sea.", editKind: "forward" });
    const view = await g.views.entity(await g.scope(), "rickard-snow");
    const edit = view!.history.find((v) => v.label === 'Section "Wants"')!;
    expect((edit.before as { bodyMd: string }).bodyMd).toMatch(/^Land of his own/);
    expect((edit.after as { bodyMd: string }).bodyMd).toBe("A keep by the sea.");
    const r = await g.engine.restoreVersion(edit.id, "retcon", "before");
    expect(r.ok).toBe(true);
    const page = await g.storage.getPage(g.rickard.id);
    expect(page!.sections.find((s) => s.key === "wants")!.bodyMd).toMatch(/^Land of his own/);
    const after = await g.views.entity(await g.scope(), "rickard-snow");
    expect(after!.history[0]!.reason).toBe(`restored version ${edit.id}`);
    expect(after!.history[0]!.editKind).toBe("retcon");
  });
});

describe("M5: spoiler toggle off hides secret sections, gm notes, and updates the PC doesn't know", () => {
  async function withSecrets() {
    const g = await game();
    // The PC is Marro; he knows one update, not the other.
    const marro = await g.engine.createEntity({ worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Marro", source: "ruling", summary: "Rickard's squire." });
    if (!marro.ok) throw new Error();
    await g.engine.updateCampaign({ sessionId: g.sessionId, pcSheet: { name: "Marro" } });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "marro" });
    await g.engine.logScene({
      sessionId: g.sessionId,
      summary: "Night watch.",
      present: ["rickard-snow", "marro"],
      updates: [fact({ body: "Rickard limps.", knows: ["rickard-snow", "marro"] }), fact({ body: "Rickard sold the company's plans.", knows: ["rickard-snow"] })],
    });
    await g.engine.gmWrite({ sessionId: g.sessionId, kind: "twist", key: "the-sale", body: "Rickard is the traitor." });
    return g;
  }

  it("player view (the default)", async () => {
    const g = await withSecrets();
    const scope = await g.scope();
    expect(scope.spoilers).toBe(false);
    const view = (await g.views.entity(scope, "rickard-snow"))!;
    expect(view.page.sections.map((s) => s.heading)).not.toContain("Hiding");
    expect(view.hiddenSections).toBe(1);
    expect(view.updates.map((u) => u.update.bodyMd)).toEqual(["Rickard limps."]);
    expect(view.hiddenUpdates).toBe(1);
    expect(await g.views.gmNotes(scope)).toBeNull();
    const search = await g.views.wiki(scope, { query: "mother" }); // only in the secret "Hiding" section
    expect(search).toEqual([]);
    const dash = (await g.views.dashboard(scope))!;
    expect(dash.hidden).toEqual({ gmNotes: 1, secretSections: 1, updates: 1 });
    expect(view.updates[0]!.tagTypes).toEqual([{ tag: "ch-01", type: "time" }]);
  });

  it("GM view after turning spoilers on, and back off again", async () => {
    const g = await withSecrets();
    await g.engine.setSpoilers(g.campaign.id, true);
    const on = await g.scope();
    const view = (await g.views.entity(on, "rickard-snow"))!;
    expect(view.page.sections.map((s) => s.heading)).toContain("Hiding");
    expect(view.updates).toHaveLength(2);
    expect((await g.views.gmNotes(on))!.map((n) => n.key)).toEqual(["the-sale"]);
    expect((await g.views.dashboard(on))!.hidden).toEqual({ gmNotes: 0, secretSections: 0, updates: 0 });
    expect((await g.views.wiki(on, { query: "mother" })).flatMap((grp) => grp.entities.map((e) => e.entity.slug))).toEqual(["rickard-snow"]);

    await g.engine.setSpoilers(g.campaign.id, false);
    expect((await g.views.entity(await g.scope(), "rickard-snow"))!.hiddenSections).toBe(1);
  });
});

describe("M5: the entity page shows the type's outline and what play recorded", () => {
  it("lists outline slots, relationships, items, knowledge, scenes, threads and the PC sheet", async () => {
    const g = await game();
    const marro = await g.engine.createEntity({ worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Marro", source: "ruling", summary: "Rickard's squire." });
    if (!marro.ok) throw new Error();
    await g.engine.updateCampaign({ sessionId: g.sessionId, pcSheet: { name: "Marro", inventory: ["dagger"] } });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "marro" });
    const logged = await g.engine.logScene({
      sessionId: g.sessionId,
      summary: "Night watch.",
      present: ["rickard-snow", "marro"],
      updates: [
        fact({ entities: ["rickard-snow", "marro"], type: "relationship", body: "Rickard trusts Marro with the payroll.", knows: ["rickard-snow", "marro"] }),
        fact({ type: "item", body: "Rickard gave Marro his whetstone.", knows: ["marro"] }),
      ],
    });
    if (!logged.ok) throw new Error(logged.refusal.message);
    await g.storage.createThread({ campaignId: g.campaign.id, title: "Rickard's limp", tags: ["rickard-snow"] }, USER);

    const r = (await g.views.entity(await g.scope(), "rickard-snow"))!.profile;
    expect(r.outline.map((o) => [o.heading, o.sectionId !== null])).toEqual([
      ["Background", false],
      ["Appearance", true],
      ["Personality", false],
      ["Wants", true],
      ["Relationships", false],
      ["Inventory", false],
    ]);
    expect(r.relationships.map((x) => [x.other.slug, x.update.bodyMd])).toEqual([["marro", "Rickard trusts Marro with the payroll."]]);
    expect(r.items.map((u) => u.bodyMd)).toEqual(["Rickard gave Marro his whetstone."]);
    expect(r.appearsWith).toEqual([{ other: expect.objectContaining({ slug: "marro" }), scenes: 1 }]);
    expect(r.scenes.map((s) => s.summaryMd)).toEqual(["Night watch."]);
    expect(r.threads.map((t) => t.title)).toEqual(["Rickard's limp"]);
    expect(r.pcSheet).toBeNull();

    const m = (await g.views.entity(await g.scope(), "marro"))!.profile;
    expect(m.pcSheet?.data.inventory).toEqual(["dagger"]);
    expect(m.knows.map((u) => u.bodyMd)).toEqual(["Rickard trusts Marro with the payroll.", "Rickard gave Marro his whetstone."]);
  });

  it("player view leaves out knowledge and relationships the PC doesn't know", async () => {
    const g = await game();
    await g.engine.createEntity({ worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Marro", source: "ruling", summary: "Squire." });
    await g.engine.updateCampaign({ sessionId: g.sessionId, pcSheet: { name: "Marro" } });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "golden-company" });
    await g.engine.logScene({
      sessionId: g.sessionId,
      summary: "A secret meeting.",
      present: ["rickard-snow"],
      updates: [fact({ entities: ["rickard-snow", "golden-company"], type: "relationship", body: "Rickard plans to betray the Company.", knows: ["rickard-snow"] })],
    });
    const off = (await g.views.entity(await g.scope(), "rickard-snow"))!.profile;
    expect(off.relationships).toEqual([]);
    expect(off.knows).toEqual([]);
    await g.engine.setSpoilers(g.campaign.id, true);
    const on = (await g.views.entity(await g.scope(), "rickard-snow"))!.profile;
    expect(on.relationships.map((x) => x.other.slug)).toEqual(["golden-company"]);
    expect(on.knows.map((u) => u.bodyMd)).toEqual(["Rickard plans to betray the Company."]);
  });
});
