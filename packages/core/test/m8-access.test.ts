// Milestone 8 acceptance: "A second account can't see or change the first account's worlds".
// Each account's engine runs on `scopeStorage(storage, userId)`, as the remote server and web app do.
import { describe, expect, it } from "vitest";
import { RulesEngine, WebViews, scopeStorage } from "../src";
import { USER, openStore } from "./helpers";

async function twoAccounts() {
  const storage = await openStore();
  const parker = await storage.createUser({ id: "user-parker", name: "Parker" }, USER);
  const other = await storage.createUser({ id: "user-other", name: "Other" }, USER);
  const engine = (id: string) => new RulesEngine(scopeStorage(storage, id), { ownerId: id });
  const a = engine(parker.id);
  const b = engine(other.id);
  const w = await a.createWorld({ name: "The Free Cities", depth: "compact", approvalMode: "autopilot" });
  if (!w.ok) throw new Error(w.refusal.message);
  const e = await a.createEntity({ worldId: w.value.id, type: "character", name: "Rickard Snow", source: "invention", summary: "Sellsword captain." });
  if (!e.ok) throw new Error(e.refusal.message);
  const c = await a.createCampaign({ worldId: w.value.id, name: "Run" });
  if (!c.ok) throw new Error(c.refusal.message);
  const open = await a.openCampaign(c.value.id);
  if (!open.ok) throw new Error(open.refusal.message);
  return { storage, a, b, world: w.value, entity: e.value, campaign: c.value, sessionId: open.value.session.id, other };
}

describe("M8: a second account can't see or change the first account's worlds", () => {
  it("the owner sees and plays their world", async () => {
    const g = await twoAccounts();
    expect((await g.a.listWorlds()).map((r) => r.world.name)).toEqual(["The Free Cities"]);
    const ctx = await g.a.getContext({ sessionId: g.sessionId, present: ["Rickard Snow"] });
    expect(ctx.ok).toBe(true);
  });

  it("the other account sees nothing: no worlds, campaigns, pages, search hits or history", async () => {
    const g = await twoAccounts();
    expect(await g.b.listWorlds()).toEqual([]);
    expect(await g.b.storage.getWorld(g.world.id)).toBeNull();
    expect(await g.b.storage.getCampaign(g.campaign.id)).toBeNull();
    expect(await g.b.storage.getEntity(g.entity.id)).toBeNull();
    expect(await g.b.storage.listEntities(g.world.id)).toEqual([]);
    expect(await g.b.storage.search(g.world.id, "Rickard")).toEqual([]);
    expect(await g.b.storage.listVersions()).toEqual([expect.objectContaining({ objectType: "user", objectId: g.other.id })]);
    expect((await g.b.changelog(g.campaign.id)).ok).toBe(false);
    expect(await g.b.reviewQueue(g.campaign.id)).toEqual([]);
    const views = new WebViews(g.b);
    expect(await views.scope({ worldId: g.world.id })).toBeNull();
    expect(await views.scope({ worldId: g.world.id, campaignId: g.campaign.id })).toBeNull();
    expect(await views.home()).toEqual([]);
  });

  it("the other account can't open, play or change it, and nothing in storage changes", async () => {
    const g = await twoAccounts();
    const before = (await g.storage.listVersions()).length;
    const refused = [
      await g.b.openCampaign(g.campaign.id),
      await g.b.getContext({ sessionId: g.sessionId, present: ["Rickard Snow"] }),
      await g.b.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" }),
      await g.b.logScene({ sessionId: g.sessionId, summary: "x", present: [], updates: [] }),
      await g.b.recordRuling({ sessionId: g.sessionId, text: "x" }),
      await g.b.editEntity({ worldId: g.world.id, entity: "rickard-snow", summary: "Dead." }),
      await g.b.updateWorld({ worldId: g.world.id, name: "Mine now" }),
      await g.b.createEntity({ worldId: g.world.id, type: "place", name: "Lys", source: "canon" }),
      await g.b.createCampaign({ worldId: g.world.id, name: "Mine" }),
      await g.b.importDocument({ worldId: g.world.id, title: "x.md", entities: [{ type: "place", name: "Lys" }] }),
      await g.b.exportWorld(g.world.id),
      await g.b.userEditEntity({ entityId: g.entity.id, patch: { summary: "Dead." }, editKind: "retcon" }),
      await g.b.setSpoilers(g.campaign.id, true),
      await g.b.setApprovalMode(g.campaign.id, "review"),
      await g.b.setVoiceAnchor({ campaignId: g.campaign.id, sample: "x", profile: "x", interiorLevel: "x" }),
    ];
    for (const r of refused) expect(r.ok).toBe(false);
    for (const r of refused) if (!r.ok) expect(r.refusal.rule).toBe("not_found");
    expect((await g.storage.listVersions()).length).toBe(before);
    expect((await g.storage.getEntity(g.entity.id))!.summary).toBe("Sellsword captain.");
  });

  it("each account's own world stays its own", async () => {
    const g = await twoAccounts();
    const mine = await g.b.createWorld({ name: "Lys", depth: "compact", approvalMode: "autopilot" });
    expect(mine.ok).toBe(true);
    expect((await g.b.listWorlds()).map((r) => r.world.name)).toEqual(["Lys"]);
    expect((await g.a.listWorlds()).map((r) => r.world.name)).toEqual(["The Free Cities"]);
  });
});
