// "To the PC" label (added after M8 with Parker's OK, SPEC updated): each character other than the PC carries a
// short campaign section `to-the-pc` (such as "Older brother") that wiki cards and the character page show.
// It lives in the campaign layer, locks on a user edit, follows the player view, and open_campaign lists
// characters that still lack one so the GM fills them in.
import { describe, expect, it } from "vitest";
import { RulesEngine, TO_PC_KEY, WebViews } from "../src";
import { USER, seed, setup } from "./helpers";

async function game() {
  const base = await setup();
  await seed(base.storage, base.world.id);
  const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode: "autopilot" }, USER);
  const engine = new RulesEngine(base.storage);
  const views = new WebViews(engine);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  const scope = async () => (await views.scope({ worldId: base.world.id, campaignId: campaign.id }))!;
  const card = async (slug: string) =>
    (await views.wiki(await scope())).flatMap((g) => g.entities).find((r) => r.entity.slug === slug)!;
  return { ...base, campaign, engine, views, scope, card, opened: opened.value, sessionId: opened.value.session.id };
}

async function label(g: Awaited<ReturnType<typeof game>>, body: string, visibility: "public" | "secret" = "public") {
  await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
  const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: TO_PC_KEY, body, visibility }] });
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

describe("To the PC label", () => {
  it("the GM sets it on a world character; it is stored in the campaign layer and shows on the wiki card and page", async () => {
    const g = await game();
    expect(g.opened.missingToPc.map((e) => e.slug)).toEqual(["rickard-snow"]);
    expect((await g.card("rickard-snow")).toPc).toBeNull();

    const page = await label(g, "Older brother");
    const sec = page.sections.find((s) => s.key === TO_PC_KEY)!;
    expect(sec).toMatchObject({ heading: "To the PC", campaignId: g.campaign.id });
    // The world page is untouched; another campaign doesn't see it.
    const world = await g.storage.getPage(page.id, { campaignId: null });
    expect(world!.sections.some((s) => s.key === TO_PC_KEY)).toBe(false);

    expect((await g.card("rickard-snow")).toPc).toBe("Older brother");
    const view = await g.views.entity(await g.scope(), "rickard-snow");
    expect(view!.page.sections.find((s) => s.key === TO_PC_KEY)?.bodyMd).toBe("Older brother");
    expect(view!.profile.outline[0]).toMatchObject({ key: TO_PC_KEY, heading: "To the PC", sectionId: sec.id });

    // Places and other types carry no label.
    expect((await g.card("volantis")).toPc).toBeNull();

    const next = await g.engine.openCampaign(g.campaign.id);
    if (!next.ok) throw new Error(next.refusal.message);
    expect(next.value.missingToPc).toEqual([]);
  });

  it("a user edit locks it against the GM", async () => {
    const g = await game();
    const page = await label(g, "Stranger");
    const u = await g.engine.userEditSection({ entityId: page.id, key: TO_PC_KEY, campaignId: g.campaign.id, body: "Older brother", editKind: "retcon" });
    expect(u.ok).toBe(true);
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: TO_PC_KEY, body: "Rival" }] });
    expect(r).toMatchObject({ ok: false, refusal: { rule: "locked_by_user" } });
    expect((await g.card("rickard-snow")).toPc).toBe("Older brother");
  });

  it("a secret label stays out of the player view until the PC knows it", async () => {
    const g = await game();
    await g.engine.createEntity({ worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Marro", source: "ruling", summary: "The PC." });
    await g.engine.updateCampaign({ sessionId: g.sessionId, pcSheet: { name: "Marro" } });
    const page = await label(g, "Half-brother", "secret");
    const sec = page.sections.find((s) => s.key === TO_PC_KEY)!;

    expect((await g.card("rickard-snow")).toPc).toBeNull();
    await g.engine.setSpoilers(g.campaign.id, true);
    expect((await g.card("rickard-snow")).toPc).toBe("Half-brother");
    await g.engine.setSpoilers(g.campaign.id, false);

    const marro = (await g.storage.getEntityBySlug(g.world.id, "marro"))!;
    await g.storage.addSectionKnowers(sec.id, [marro.id], { author: "ai" });
    expect((await g.card("rickard-snow")).toPc).toBe("Half-brother");
  });

  it("the PC has no label and no slot, and isn't listed as missing one", async () => {
    const g = await game();
    await g.engine.createEntity({ worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Marro", source: "ruling", summary: "The PC." });
    await g.engine.updateCampaign({ sessionId: g.sessionId, pcSheet: { name: "Marro" } });
    const opened = await g.engine.openCampaign(g.campaign.id);
    if (!opened.ok) throw new Error(opened.refusal.message);
    expect(opened.value.missingToPc.map((e) => e.slug)).toEqual(["rickard-snow"]);
    const view = await g.views.entity(await g.scope(), "marro");
    expect(view!.profile.outline.some((o) => o.key === TO_PC_KEY)).toBe(false);
  });

  it("a \"To PC\" section from create_entity is stored as to-the-pc", async () => {
    const g = await game();
    const r = await g.engine.createEntity({
      worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Ansel", source: "invention",
      sections: [{ heading: "To PC", body: "Brother-in-law. Grieves for him." }],
    });
    if (!r.ok) throw new Error(r.refusal.message);
    expect(r.value.sections.map((s) => [s.key, s.heading])).toEqual([[TO_PC_KEY, "To the PC"]]);
    expect((await g.card("ansel")).toPc).toBe("Brother-in-law");
  });

  it("an older to-pc section counts as the label: card, page slot, missing list, and later edits change it in place", async () => {
    const g = await game();
    const made = await g.storage.createEntity(
      { worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Cobb", source: "invention", summary: "", status: "confirmed",
        sections: [{ key: "to-pc", heading: "To PC", bodyMd: "Gail's older brother, nearest him in age. Doesn't know." }] },
      { author: "ai", reason: null },
    );
    expect((await g.card("cobb")).toPc).toBe("Gail's older brother, nearest him in age");
    const opened = await g.engine.openCampaign(g.campaign.id);
    if (!opened.ok) throw new Error(opened.refusal.message);
    expect(opened.value.missingToPc.map((e) => e.slug)).not.toContain("cobb");
    const view = await g.views.entity(await g.scope(), "cobb");
    expect(view!.profile.outline[0]).toMatchObject({ key: TO_PC_KEY, sectionId: made.sections[0]!.id });

    await g.engine.readEntity({ sessionId: opened.value.session.id, ref: "cobb" });
    const r = await g.engine.editEntity({ sessionId: opened.value.session.id, entity: "cobb", sections: [{ key: TO_PC_KEY, body: "Older brother" }] });
    if (!r.ok) throw new Error(r.refusal.message);
    expect(r.value.sections.filter((s) => s.key === TO_PC_KEY || s.key === "to-pc")).toHaveLength(1);
    expect((await g.card("cobb")).toPc).toBe("Older brother");
  });

  it("a label longer than a few words is refused, with a hint to use Relationships", async () => {
    const g = await game();
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: TO_PC_KEY, body: "Gail's little sister, the only sibling younger than him" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.message).toMatch(/Relationships/);
    const made = await g.engine.createEntity({ worldId: g.world.id, campaignId: g.campaign.id, type: "character", name: "Pip", source: "invention", sections: [{ heading: "To PC", body: "Gail's little sister, the only sibling younger than him" }] });
    expect(made.ok).toBe(false);
  });
});
