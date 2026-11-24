// Milestone 6 (SPEC "Phase 0: building the world"), at the rules-engine level:
//  - A compact world built entirely by interview, every page approved: drafted pages follow the approval mode
//  - The world's as-of moment, where new campaigns start
//  - edit_entity while building the world, and `source` to upgrade an unverified page
//  - log_scene records a secret section the PC learns, and the player view then shows it
import { describe, expect, it } from "vitest";
import { RulesEngine, WebViews, assembleEntityContext, exportWorld, pageStatusFor } from "../src";
import { USER, seed, setup } from "./helpers";

async function building(mode: "review" | "batch" | "autopilot" | "mixed" = "review") {
  const base = await setup();
  const engine = new RulesEngine(base.storage);
  const w = await engine.createWorld({ name: "Saltmarch", pitch: "Drowned towns and toll-lords.", depth: "compact", approvalMode: mode });
  if (!w.ok) throw new Error(w.refusal.message);
  return { ...base, engine, views: new WebViews(engine), w: w.value };
}

describe("M6: a compact world built entirely by interview, every page approved", () => {
  it("stores Claude's drafts as proposed under review, batch and mixed, and as confirmed under autopilot", async () => {
    expect(pageStatusFor({ defaultApprovalMode: "review" })).toBe("proposed");
    expect(pageStatusFor({ defaultApprovalMode: "batch" })).toBe("proposed");
    expect(pageStatusFor({ defaultApprovalMode: "mixed" })).toBe("proposed");
    expect(pageStatusFor({ defaultApprovalMode: "autopilot" })).toBe("confirmed");
    // A campaign page follows the campaign's mode; under mixed, a new page counts as major.
    expect(pageStatusFor({ approvalMode: "mixed", severityPolicy: { minor: "autopilot", major: "review" } })).toBe("proposed");
    expect(pageStatusFor({ approvalMode: "mixed", severityPolicy: { minor: "review", major: "autopilot" } })).toBe("confirmed");

    const g = await building("review");
    const page = await g.engine.createEntity({ worldId: g.w.id, type: "place", name: "Saltmarch Overview", source: "invention", summary: "A drowned coast." });
    expect(page.ok && page.value.status).toBe("proposed");
    const auto = await building("autopilot");
    const p2 = await auto.engine.createEntity({ worldId: auto.w.id, type: "place", name: "Gullhaven", source: "invention" });
    expect(p2.ok && p2.value.status).toBe("confirmed");
  });

  it("labels proposed pages in context, lists them for review, and approving makes them canon", async () => {
    const g = await building("review");
    const steps = [
      { type: "concept" as const, name: "Overview", summary: "Drowned towns ruled by toll-lords." },
      { type: "place" as const, name: "Gullhaven", summary: "The last dry harbor." },
      { type: "faction" as const, name: "The Tollkeepers", summary: "They own every bridge." },
      { type: "character" as const, name: "Maren Vos", summary: "Tollkeeper heir." },
    ];
    const ids: string[] = [];
    for (const s of steps) {
      const r = await g.engine.createEntity({ worldId: g.w.id, ...s, source: "invention", sections: [{ heading: "Notes", body: "Drafted in the interview." }] });
      if (!r.ok) throw new Error(r.refusal.message);
      ids.push(r.value.id);
    }
    const scope = (await g.views.scope({ worldId: g.w.id }))!;
    expect((await g.views.pageQueue(scope)).map((p) => p.entity.name)).toEqual(expect.arrayContaining(steps.map((s) => s.name)));

    // In a campaign's context, a proposed page ranks as proposed and says so.
    const camp = await g.engine.createCampaign({ worldId: g.w.id, name: "Run" });
    if (!camp.ok) throw new Error(camp.refusal.message);
    const maren = (await g.storage.getEntity(ids[3]!))!;
    const ctx = await assembleEntityContext(g.storage, camp.value, maren);
    expect(ctx.items.every((i) => i.rank === 4 && /PROPOSED PAGE/.test(i.label ?? ""))).toBe(true);
    const guide = (await exportWorld(g.storage, g.w.id)).get("worlds/saltmarch/00-load-guide.md")!;
    expect(guide).toMatch(/Maren Vos\]\(characters\/maren-vos\.md\) \(proposed, not yet approved\)/);

    for (const id of ids) {
      const r = await g.engine.approvePage(id);
      expect(r.ok && r.value.status).toBe("confirmed");
    }
    expect(await g.views.pageQueue(scope)).toEqual([]);
    const after = await assembleEntityContext(g.storage, camp.value, (await g.storage.getEntity(ids[3]!))!);
    expect(after.items.every((i) => i.rank === 3 && i.label === null)).toBe(true);
    // Approving twice is refused; nothing else is written.
    expect((await g.engine.approvePage(ids[0]!)).ok).toBe(false);
  });

  it("rejecting keeps the page as a record but drops it from lookups, search and the queue, and frees its name", async () => {
    const g = await building("review");
    const r = await g.engine.createEntity({ worldId: g.w.id, type: "character", name: "Old Ivo", aliases: ["the ferryman"], source: "invention", summary: "Ferryman." });
    if (!r.ok) throw new Error(r.refusal.message);
    const rejected = await g.engine.rejectPage(r.value.id);
    expect(rejected.ok && rejected.value.status).toBe("rejected");
    expect((await g.storage.getEntity(r.value.id))!.status).toBe("rejected");
    expect((await g.storage.resolveEntity(g.w.id, "the ferryman")).status).toBe("unknown");
    expect(await g.storage.search(g.w.id, "Ferryman")).toEqual([]);
    expect(await g.storage.listEntities(g.w.id)).toEqual([]);
    const again = await g.engine.createEntity({ worldId: g.w.id, type: "character", name: "Old Ivo", source: "invention" });
    expect(again.ok && again.value.slug).toBe("old-ivo");
    const v = await g.storage.listVersions({ objectId: r.value.id });
    expect(v.map((x) => x.author)).toEqual(["ai", "user"]);
  });

  it("confirm_import pages are confirmed: the user accepted them", async () => {
    const g = await building("review");
    const imp = await g.engine.importDocument({ worldId: g.w.id, title: "bible.md", entities: [{ type: "place", name: "Gullhaven", summary: "Harbor." }] });
    if (!imp.ok) throw new Error(imp.refusal.message);
    const c = await g.engine.confirmImport({ importId: imp.value.importId, accept: [0] });
    expect(c.ok && c.value.created[0]!.status).toBe("confirmed");
  });
});

describe("M6: the world's as-of moment", () => {
  it("is set at creation or later, exported in the load guide, and new campaigns start from it", async () => {
    const g = await building("review");
    expect(g.w.asOfStoryTime).toBeNull();
    const u = await g.engine.updateWorld({ worldId: g.w.id, asOf: "Spring of the Low Tide year" });
    expect(u.ok && u.value.asOfStoryTime).toBe("Spring of the Low Tide year");
    const camp = await g.engine.createCampaign({ worldId: g.w.id, name: "Run" });
    expect(camp.ok && camp.value.asOfStoryTime).toBe("Spring of the Low Tide year");
    const guide = (await exportWorld(g.storage, g.w.id)).get("worlds/saltmarch/00-load-guide.md")!;
    expect(guide).toMatch(/as_of: Spring of the Low Tide year/);
    const made = await g.engine.createWorld({ name: "Second", depth: "full", approvalMode: "batch", asOf: "Year 1" });
    expect(made.ok && made.value.asOfStoryTime).toBe("Year 1");
  });
});

describe("M6: edit_entity while building the world, and source upgrades", () => {
  it("edits a world page with world_id and no session; a changed approved page goes back to proposed", async () => {
    const g = await building("review");
    const r = await g.engine.createEntity({ worldId: g.w.id, type: "place", name: "Gullhaven", source: "invention", summary: "Harbor." });
    if (!r.ok) throw new Error(r.refusal.message);
    await g.engine.approvePage(r.value.id);
    const e = await g.engine.editEntity({ worldId: g.w.id, entity: "gullhaven", summary: "The last dry harbor.", sections: [{ key: "docks", heading: "Docks", body: "Stilted." }] });
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.value.summary).toBe("The last dry harbor.");
    expect(e.value.sections.map((s) => s.key)).toEqual(["docks"]);
    expect(e.value.status).toBe("proposed");
    expect((await g.engine.editEntity({ entity: "gullhaven", summary: "x" })).ok).toBe(false);
  });

  it("upgrades an unverified page to canon on the user's confirmation, and never to ruling", async () => {
    const g = await building("autopilot");
    const r = await g.engine.createEntity({ worldId: g.w.id, type: "character", name: "Captain Hale", source: "unverified", summary: "From the novels." });
    if (!r.ok) throw new Error(r.refusal.message);
    const up = await g.engine.editEntity({ worldId: g.w.id, entity: "captain-hale", source: "canon" });
    expect(up.ok && up.value.source).toBe("canon");
    expect(up.ok && up.value.status).toBe("confirmed");
    const bad = await g.engine.editEntity({ worldId: g.w.id, entity: "captain-hale", source: "ruling" });
    expect(!bad.ok && bad.refusal.rule).toBe("invalid");

    // During play too, with a read first.
    const camp = await g.engine.createCampaign({ worldId: g.w.id, name: "Run" });
    if (!camp.ok) throw new Error(camp.refusal.message);
    const open = await g.engine.openCampaign(camp.value.id);
    if (!open.ok) throw new Error(open.refusal.message);
    const sid = open.value.session.id;
    const before = await g.engine.editEntity({ sessionId: sid, entity: "captain-hale", source: "unverified" });
    expect(!before.ok && before.refusal.rule).toBe("read_before_write");
    await g.engine.readEntity({ sessionId: sid, ref: "captain-hale" });
    const back = await g.engine.editEntity({ sessionId: sid, entity: "captain-hale", source: "unverified" });
    expect(back.ok && back.value.source).toBe("unverified");
  });
});

describe("M6: log_scene records a secret the PC learns", () => {
  it("writes the knowledge row, shows the section in the player view, and refuses public or unread sections", async () => {
    const base = await setup();
    const ents = await seed(base.storage, base.world.id);
    const engine = new RulesEngine(base.storage);
    const views = new WebViews(engine);
    const pc = await engine.createEntity({ worldId: base.world.id, type: "character", name: "Asha Reed", source: "invention" });
    if (!pc.ok) throw new Error(pc.refusal.message);
    await engine.approvePage(pc.value.id);
    const camp = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run", approvalMode: "autopilot" }, USER);
    await base.storage.setPcSheet({ campaignId: camp.id, data: { name: "Asha Reed" } }, USER);
    const open = await engine.openCampaign(camp.id);
    if (!open.ok) throw new Error(open.refusal.message);
    const sid = open.value.session.id;
    const scope = async () => (await views.scope({ worldId: base.world.id, campaignId: camp.id }))!;
    const hiding = ents.rickard.sections.find((s) => s.key === "hiding")!;

    const shown = async () => (await views.entity(await scope(), "rickard-snow"))!.page.sections.map((s) => s.key);
    expect(await shown()).not.toContain("hiding");

    const unread = await engine.logScene({ sessionId: sid, summary: "Rickard confides.", present: ["rickard-snow", "asha-reed"], updates: [], secretsLearned: [{ entity: "rickard-snow", section: "hiding", by: ["asha-reed"] }] });
    expect(!unread.ok && unread.refusal.rule).toBe("read_before_write");

    await engine.getContext({ sessionId: sid, present: ["rickard-snow", "asha-reed"] });
    const pub = await engine.logScene({ sessionId: sid, summary: "x", present: ["rickard-snow"], updates: [], secretsLearned: [{ entity: "rickard-snow", section: "wants", by: ["asha-reed"] }] });
    expect(!pub.ok && pub.refusal.rule).toBe("invalid");

    const logged = await engine.logScene({ sessionId: sid, summary: "Rickard confides.", present: ["rickard-snow", "asha-reed"], updates: [], secretsLearned: [{ entity: "rickard-snow", section: "hiding", by: ["Asha"] }] });
    expect(!logged.ok && logged.refusal.rule).toBe("unknown_reference");
    const ok = await engine.logScene({ sessionId: sid, summary: "Rickard confides.", present: ["rickard-snow", "asha-reed"], updates: [], secretsLearned: [{ entity: "rickard-snow", section: "hiding", by: ["asha-reed"] }] });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.secretsLearned.map((x) => [x.section.key, x.knowers.map((k) => k.slug)])).toEqual([["hiding", ["asha-reed"]]]);
    expect(await base.storage.listKnowers("section", hiding.id)).toEqual([pc.value.id]);
    expect(await shown()).toContain("hiding");
  });
});
