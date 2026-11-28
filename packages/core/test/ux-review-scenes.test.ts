// UX review #22/#23: review rows know their scene, time and whether the PC knows them; approve a scene at once.
import { describe, expect, it } from "vitest";
import { RulesEngine, WebViews } from "../src";
import { AI, USER, seed, setup } from "./helpers";

describe("UX #22/#23: review queue by scene", () => {
  it("labels each update with its scene and PC knowledge, and approves one scene's updates, skipping conflicts", async () => {
    const { storage, world, user } = await setup();
    const { rickard, volantis } = await seed(storage, world.id);
    const c = await storage.createCampaign({ worldId: world.id, ownerId: user.id, name: "Run", approvalMode: "review" }, USER);
    const pc = await storage.createEntity({ worldId: world.id, campaignId: c.id, type: "character", name: "Asha", source: "invention" }, AI);
    await storage.setPcSheet({ campaignId: c.id, data: { name: "Asha" } }, USER);
    const s1 = await storage.createScene({ campaignId: c.id, chapter: 1, placeEntityId: volantis.id }, AI);
    await storage.updateScene(s1.id, { summaryMd: "At the gate.", loggedAt: new Date().toISOString() }, AI);
    const s2 = await storage.createScene({ campaignId: c.id, chapter: 1 }, AI);
    const base = { campaignId: c.id, entityIds: [rickard.id], tags: [], type: "new-fact" as const, severity: "major" as const, status: "proposed" as const };
    const a = await storage.createUpdate({ ...base, sceneId: s1.id, bodyMd: "A", knows: [pc.id] }, AI);
    const b = await storage.createUpdate({ ...base, sceneId: s1.id, bodyMd: "B" }, AI);
    const x = await storage.createUpdate({ ...base, sceneId: s1.id, bodyMd: "X", conflictsWith: { type: "update", id: a.id } }, AI);
    const other = await storage.createUpdate({ ...base, sceneId: s2.id, bodyMd: "Other" }, AI);

    const engine = new RulesEngine(storage);
    const views = new WebViews(engine);
    await engine.setSpoilers(c.id, true);
    const scope = (await views.scope({ worldId: world.id, campaignId: c.id }))!;
    const { items } = await views.reviewQueue(scope);
    const byBody = new Map(items.map((i) => [i.update.bodyMd, i]));
    expect(byBody.get("A")).toMatchObject({ pcKnows: true, scene: { chapter: 1, number: 1, place: { name: "Volantis" }, summary: "At the gate." } });
    expect(byBody.get("B")!.pcKnows).toBe(false);
    expect(byBody.get("B")!.at).toBeTruthy();

    const approved = await views.approveVisibleScene(scope, s1.id);
    expect(approved.map((u) => u.id).sort()).toEqual([a.id, b.id].sort());
    expect((await storage.getUpdate(x.id))!.status).toBe("proposed");
    expect((await storage.getUpdate(other.id))!.status).toBe("proposed");
  });
});

describe("UX #26: alias URLs and near misses", () => {
  it("resolves an alias to its slug and suggests close pages for an unknown one", async () => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    const views = new WebViews(new RulesEngine(storage));
    const scope = (await views.scope({ worldId: world.id }))!;
    expect(await views.lookup(scope, "the-bastard-sellsword")).toEqual({ slug: "rickard-snow" });
    const miss = await views.lookup(scope, "volantys");
    expect("suggestions" in miss && miss.suggestions.map((e) => e.slug)).toContain("volantis");
  });
});

describe("UX #11: search says why a hit matched", () => {
  it("names the alias, or quotes the section, but never a hidden secret", async () => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    const engine = new RulesEngine(storage);
    const views = new WebViews(engine);
    const scope = (await views.scope({ worldId: world.id, spoilers: false }))!;
    const rows = async (q: string) => (await views.wiki(scope, { query: q })).flatMap((g) => g.entities);
    expect((await rows("bastard"))[0]!.match).toEqual({ alias: "the bastard sellsword" });
    expect((await rows("winter"))[0]!.match).toMatchObject({ section: "Wants", snippet: expect.stringContaining("before winter") });
    expect((await rows("Rickard"))[0]!.match).toBeNull();
    const gm = (await views.scope({ worldId: world.id, spoilers: true }))!;
    const secret = (await views.wiki(gm, { query: "mother" })).flatMap((g) => g.entities)[0]!;
    expect(secret.match).toMatchObject({ section: "Hiding" });
    expect(await rows("mother")).toEqual([]);
  });
});
