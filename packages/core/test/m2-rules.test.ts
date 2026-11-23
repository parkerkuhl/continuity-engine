// Milestone 2 acceptance:
//  - One passing unit test per rule in SPEC "Server-enforced rules", covering both the allowed and refused path
//  - A write refused by a rule changes nothing in storage
// Each `describe` below is one rule. Refused paths compare a dump of every table before and after.
import { describe, expect, it } from "vitest";
import { RulesEngine, SqliteStorage, type Campaign, type UpdateInput } from "../src";
import { AI, USER, seed, setup } from "./helpers";

async function game(approvalMode: Campaign["approvalMode"] = "autopilot") {
  const base = await setup();
  const ents = await seed(base.storage, base.world.id);
  const campaign = await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run 1", approvalMode }, USER);
  const engine = new RulesEngine(base.storage);
  const opened = await engine.openCampaign(campaign.id);
  if (!opened.ok) throw new Error(opened.refusal.message);
  return { ...base, ...ents, campaign, engine, sessionId: opened.value.session.id };
}

const fact = (over: Partial<UpdateInput> = {}): UpdateInput => ({
  entities: ["rickard-snow"],
  tags: ["ch-01"],
  type: "status-change",
  severity: "minor",
  body: "Rickard took a crossbow bolt to the left shoulder.",
  ...over,
});

/** Assert that `fn` is refused with `rule` and that no table changed. */
async function expectRefusedNoChange(storage: SqliteStorage, rule: string, fn: () => Promise<{ ok: boolean; refusal?: { rule: string } }>) {
  const before = storage.dump();
  const r = await fn();
  expect(r.ok).toBe(false);
  expect(r.refusal!.rule).toBe(rule);
  expect(storage.dump()).toEqual(before);
  return r as { ok: false; refusal: { rule: string; message: string; suggestions?: string[] } };
}

async function logOne(g: Awaited<ReturnType<typeof game>>, u: UpdateInput) {
  const r = await g.engine.logScene({ sessionId: g.sessionId, summary: "A scene.", present: ["rickard-snow"], updates: [u] });
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value.results[0]!;
}

describe("Rule: read before write", () => {
  it("allowed: an update to an entity read this session (via get_context) is stored", async () => {
    const g = await game();
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    const res = await logOne(g, fact());
    expect(res.ok).toBe(true);
  });

  it("allowed: read_entity also counts as a read", async () => {
    const g = await game();
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "Golden Company" });
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "golden-company", sections: [{ key: "aims", body: "Gold first." }] });
    expect(r.ok).toBe(true);
  });

  it("refused: an edit to an unread entity names the entity to read and changes nothing", async () => {
    const g = await game();
    const r = await expectRefusedNoChange(g.storage, "read_before_write", () =>
      g.engine.editEntity({ sessionId: g.sessionId, entity: "Snow", sections: [{ key: "wants", body: "Revenge." }] }),
    );
    expect(r.refusal.message).toContain('read_entity("rickard-snow")');
  });

  it("refused: an update to an unread entity is refused and nothing of it is stored", async () => {
    const g = await game();
    const res = await logOne(g, fact());
    expect(res).toMatchObject({ ok: false, refusal: { rule: "read_before_write", ref: "rickard-snow" } });
    expect(await g.storage.listUpdates(g.campaign.id)).toEqual([]);
  });

  it("refused: reads from an earlier session don't count", async () => {
    const g = await game();
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const next = await g.engine.openCampaign(g.campaign.id);
    if (!next.ok) throw new Error();
    await expectRefusedNoChange(g.storage, "read_before_write", () =>
      g.engine.editEntity({ sessionId: next.value.session.id, entity: "rickard-snow", sections: [{ key: "wants", body: "x" }] }),
    );
    // and the old session itself is closed
    await expectRefusedNoChange(g.storage, "session_closed", () =>
      g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: "x" }] }),
    );
  });
});

describe("Rule: alias resolution", () => {
  it("allowed: aliases in entities, tags, present and knows resolve to canonical entities", async () => {
    const g = await game();
    await g.engine.getContext({ sessionId: g.sessionId, present: ["the bastard sellsword", "Goldcloaks"], place: "Old Volantis" });
    const r = await g.engine.logScene({
      sessionId: g.sessionId,
      summary: "Retreat.",
      present: ["Snow", "the Company"],
      place: "old volantis",
      updates: [fact({ entities: ["Commander"], tags: ["volantis", "goldcloaks", "ch-12"], knows: ["the-company"] })],
    });
    if (!r.ok) throw new Error(r.refusal.message);
    const res = r.value.results[0]!;
    if (!res.ok) throw new Error(res.refusal.message);
    expect(res.update.entityIds).toEqual([g.rickard.id]);
    expect(res.update.tags).toEqual(["volantis", "golden-company", "ch-12"]);
    expect(await g.storage.listKnowers("update", res.update.id)).toEqual([g.company.id]);
    expect(r.value.scene).toMatchObject({ presentEntityIds: [g.rickard.id, g.company.id], placeEntityId: g.volantis.id });
  });

  it("refused: an unknown reference returns the closest matches, is never auto-created, and changes nothing", async () => {
    const g = await game();
    const r = await expectRefusedNoChange(g.storage, "unknown_reference", () =>
      g.engine.getContext({ sessionId: g.sessionId, present: ["Rikard Snow"] }),
    );
    expect(r.refusal.suggestions).toEqual(["rickard-snow"]);
    await expectRefusedNoChange(g.storage, "unknown_reference", () =>
      g.engine.logScene({ sessionId: g.sessionId, summary: "x", present: ["Marro"], updates: [] }),
    );
  });

  it("refused: an unknown tag or a non-kebab tag", async () => {
    const g = await game();
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    expect(await logOne(g, fact({ tags: ["braavos"] }))).toMatchObject({ ok: false, refusal: { rule: "invalid_tag" } });
    expect(await logOne(g, fact({ tags: ["Ch 12"] }))).toMatchObject({ ok: false, refusal: { rule: "invalid_tag" } });
    expect(await g.storage.listUpdates(g.campaign.id)).toEqual([]);
  });

  it("refused: an ambiguous reference asks for the slug", async () => {
    const g = await game();
    await g.storage.createEntity({ worldId: g.world.id, type: "character", name: "Jon Snow", aliases: ["Snow"], source: "invention" }, AI);
    const r = await expectRefusedNoChange(g.storage, "ambiguous_reference", () => g.engine.readEntity({ sessionId: g.sessionId, ref: "Snow" }));
    expect(r.refusal.suggestions!.sort()).toEqual(["jon-snow", "rickard-snow"]);
  });
});

describe("Rule: precedence", () => {
  it("orders context as user edits and rulings, campaign canon, world canon, proposed, unverified, and labels the soft ones", async () => {
    const g = await game("mixed"); // minor -> confirmed, major -> proposed
    // rank 1: a user-edited world section
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A pardon.", editKind: "retcon" });
    // rank 2: a campaign overlay section, and a confirmed update
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "hiding", body: "Campaign secret." }] });
    await logOne(g, fact({ severity: "minor", body: "Limps." }));
    // rank 4: a proposed update
    await logOne(g, fact({ severity: "major", body: "Lost the arm." }));

    const ctx = await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    if (!ctx.ok) throw new Error();
    const items = ctx.value.entities[0]!.items;
    const ranks = items.map((i) => i.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const describeItem = (i: (typeof items)[number]) =>
      i.kind === "section" ? `${i.rank}:${i.layer}:${i.section.key}` : i.kind === "update" ? `${i.rank}:update:${i.update.bodyMd}` : `${i.rank}:summary`;
    expect(items.map(describeItem)).toEqual([
      "1:world:appearance", // locked in the seed
      "1:world:wants", // user edit
      "2:campaign:hiding", // overlay replaces the world "hiding"
      "2:update:Limps.",
      "3:summary",
      "4:update:Lost the arm.",
    ]);
    expect(items.find((i) => i.kind === "update" && i.update.bodyMd === "Lost the arm.")!.label).toMatch(/^PROPOSED/);
    expect(items.filter((i) => i.rank < 4).every((i) => i.label === null)).toBe(true);
  });

  it("refused: a lower source never hides a higher one (an AI overlay can't hide a user-locked world section)", async () => {
    const g = await game();
    // a campaign overlay written directly, as an import or older data might have, sitting over a locked world section
    await g.storage.addSection(g.rickard.id, { campaignId: g.campaign.id, heading: "Appearance", bodyMd: "Short and fair." }, AI);
    const ctx = await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    if (!ctx.ok) throw new Error();
    const appearance = ctx.value.entities[0]!.items.filter((i) => i.kind === "section" && i.section.key === "appearance");
    expect(appearance.map((i) => (i.kind === "section" ? [i.rank, i.layer] : null))).toEqual([
      [1, "world"],
      [2, "campaign"],
    ]);
  });

  it("labels unverified pages, ranked last", async () => {
    const g = await game();
    await g.storage.createEntity(
      { worldId: g.world.id, type: "place", name: "Braavos", source: "unverified", summary: "City of canals.", sections: [{ heading: "Harbor", bodyMd: "Arsenal." }] },
      AI,
    );
    const ctx = await g.engine.getContext({ sessionId: g.sessionId, present: ["braavos"] });
    if (!ctx.ok) throw new Error();
    const items = ctx.value.entities[0]!.items;
    expect(items.every((i) => i.rank === 5 && i.label?.startsWith("UNVERIFIED"))).toBe(true);
  });
});

describe("Rule: approval modes", () => {
  it.each([
    ["review", "minor", "proposed"],
    ["batch", "minor", "proposed"],
    ["autopilot", "major", "confirmed"],
    ["mixed", "minor", "confirmed"],
    ["mixed", "major", "proposed"],
  ] as const)("allowed: %s mode stores a %s AI update as %s", async (mode, severity, status) => {
    const g = await game(mode);
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    expect(await logOne(g, fact({ severity }))).toMatchObject({ ok: true, status });
  });

  it("allowed: the mode is changeable anytime and applies to the next write", async () => {
    const g = await game("autopilot");
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    expect(await logOne(g, fact())).toMatchObject({ status: "confirmed" });
    await g.engine.setApprovalMode(g.campaign.id, "mixed", { minor: "review", major: "autopilot" });
    expect(await logOne(g, fact({ severity: "minor" }))).toMatchObject({ status: "proposed" });
    expect(await logOne(g, fact({ severity: "major" }))).toMatchObject({ status: "confirmed" });
  });

  it("refused: an unknown mode or incomplete severity policy changes nothing", async () => {
    const g = await game();
    await expectRefusedNoChange(g.storage, "invalid", () => g.engine.setApprovalMode(g.campaign.id, "yolo" as "batch"));
    await expectRefusedNoChange(g.storage, "invalid", () =>
      g.engine.setApprovalMode(g.campaign.id, "mixed", { minor: "autopilot" } as Campaign["severityPolicy"]),
    );
  });
});

describe("Rule: forced-major types", () => {
  it.each(["death", "knowledge", "faction-shift", "world-rule"] as const)("refused minor: %s is stored as major", async (type) => {
    const g = await game("mixed");
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    const res = await logOne(g, fact({ type, severity: "minor" }));
    expect(res).toMatchObject({ ok: true, forcedMajor: true, status: "proposed", update: { severity: "major" } });
  });

  it("allowed: other types keep the AI's severity", async () => {
    const g = await game("mixed");
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    expect(await logOne(g, fact({ type: "location", severity: "minor" }))).toMatchObject({
      ok: true,
      forcedMajor: false,
      status: "confirmed",
      update: { severity: "minor" },
    });
  });
});

describe("Rule: user locks", () => {
  it("allowed: an AI edit to an unlocked section goes to the campaign layer and leaves world canon alone", async () => {
    const g = await game();
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const r = await g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: "Revenge." }] });
    if (!r.ok) throw new Error(r.refusal.message);
    expect(r.value.sections.find((s) => s.key === "wants")).toMatchObject({ bodyMd: "Revenge.", campaignId: g.campaign.id });
    expect((await g.storage.getPage(g.rickard.id))!.sections.find((s) => s.key === "wants")!.bodyMd).toMatch(/^Land of his own/);
  });

  it("refused: once the user edits a section it is locked, and an AI edit to it is refused with no change", async () => {
    const g = await game();
    const edited = await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A pardon.", editKind: "forward" });
    expect(edited).toMatchObject({ ok: true, value: { lockedByUser: true } });
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const r = await expectRefusedNoChange(g.storage, "locked_by_user", () =>
      g.engine.editEntity({ sessionId: g.sessionId, entity: "rickard-snow", sections: [{ key: "wants", body: "Revenge." }] }),
    );
    expect(r.refusal.message).toContain("proposes_section");
  });

  it("allowed: instead, the AI logs an update proposing the change, which is parked next to the locked text", async () => {
    const g = await game("autopilot");
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    const res = await logOne(g, fact({ proposes_section: { entity: "rickard-snow", key: "appearance" }, body: "Now has a beard." }));
    const appearance = g.rickard.sections.find((s) => s.key === "appearance")!;
    expect(res).toMatchObject({ ok: true, status: "proposed", update: { conflictsWith: { type: "section", id: appearance.id } } });
  });
});

describe("Rule: conflicts", () => {
  async function withConfirmedMajor(mode: Campaign["approvalMode"] = "autopilot") {
    const g = await game(mode);
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    const first = await logOne(g, fact({ severity: "major", body: "Wounded." }));
    if (!first.ok) throw new Error();
    return { ...g, first: first.update };
  }

  it("refused merge: superseding a confirmed major fact is parked as proposed with a conflicts_with link, even on autopilot", async () => {
    const g = await withConfirmedMajor();
    const res = await logOne(g, fact({ supersedes: g.first.seq, severity: "minor", body: "Not wounded after all." }));
    expect(res).toMatchObject({ ok: true, status: "proposed", update: { conflictsWith: { type: "update", id: g.first.id } } });
    expect((await g.storage.getUpdate(g.first.id))!.status).toBe("confirmed"); // the confirmed fact stands
    const queue = await g.engine.reviewQueue(g.campaign.id);
    expect(queue[0]!.conflictsWith).not.toBeNull(); // pinned on top
  });

  it("refused merge: superseding a user-authored update is a conflict too", async () => {
    const g = await game("autopilot");
    const userFact = await g.storage.createUpdate(
      { campaignId: g.campaign.id, entityIds: [g.rickard.id], tags: [], type: "new-fact", severity: "minor", status: "confirmed", bodyMd: "Left-handed." },
      USER,
    );
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    expect(await logOne(g, fact({ supersedes: userFact.seq }))).toMatchObject({ status: "proposed", update: { conflictsWith: { id: userFact.id } } });
  });

  it("allowed: superseding a minor confirmed fact follows the approval mode, and approval marks the old one superseded", async () => {
    const g = await game("autopilot");
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    const first = await logOne(g, fact({ severity: "minor", body: "At the camp." }));
    if (!first.ok) throw new Error();
    const second = await logOne(g, fact({ supersedes: first.update.seq, body: "At the docks." }));
    expect(second).toMatchObject({ ok: true, status: "confirmed", update: { conflictsWith: null, supersedesId: first.update.id } });

    // and when a parked conflict is approved, the superseded fact is marked superseded
    const g2 = await withConfirmedMajor();
    const parked = await logOne(g2, fact({ supersedes: g2.first.seq, body: "Healed." }));
    if (!parked.ok) throw new Error();
    await g2.engine.approveUpdate(parked.update.id);
    expect((await g2.storage.getUpdate(g2.first.id))!.status).toBe("superseded");
    expect((await g2.storage.getUpdate(parked.update.id))!.status).toBe("confirmed");
  });

  it("refused: superseding an update that doesn't exist is refused and stores nothing", async () => {
    const g = await withConfirmedMajor();
    expect(await logOne(g, fact({ supersedes: 99 }))).toMatchObject({ ok: false, refusal: { rule: "not_found" } });
    expect((await g.storage.listUpdates(g.campaign.id)).length).toBe(1);
  });
});

describe("Rule: retcon or going forward", () => {
  it("allowed: a user fact edit is stored with its edit kind", async () => {
    const g = await game();
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A pardon.", editKind: "retcon", reason: "always wanted it" });
    await g.engine.userEditEntity({ entityId: g.volantis.id, patch: { summary: "Burning." }, editKind: "forward" });
    const kinds = (await g.storage.listVersions({ author: "user" })).map((v) => v.editKind).filter(Boolean);
    expect(kinds).toEqual(["retcon", "forward"]);
  });

  it("allowed: toggling visibility is not a fact change and needs no edit kind", async () => {
    const g = await game();
    expect((await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", visibility: "secret" })).ok).toBe(true);
  });

  it("refused: a user fact edit without retcon or forward changes nothing", async () => {
    const g = await game();
    await expectRefusedNoChange(g.storage, "edit_kind_required", () =>
      g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A pardon." }),
    );
    await expectRefusedNoChange(g.storage, "edit_kind_required", () =>
      g.engine.userEditEntity({ entityId: g.rickard.id, patch: { summary: "Dead." } }),
    );
  });
});

describe("Rule: change feed", () => {
  it("allowed: open_campaign returns every user edit since the last session, grouped by entity, with its edit kind", async () => {
    const g = await game();
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A pardon.", editKind: "retcon" });
    await g.engine.userEditEntity({ entityId: g.rickard.id, patch: { aliases: ["Snow", "the Pardoned"] } });
    await g.engine.userEditEntity({ entityId: g.volantis.id, patch: { summary: "Burning." }, editKind: "forward" });
    const next = await g.engine.openCampaign(g.campaign.id);
    if (!next.ok) throw new Error();
    expect(next.value.changes.map((c) => [c.label, c.changes.map((v) => `${v.objectType}:${v.editKind}`)])).toEqual([
      ["rickard-snow", ["section:retcon", "entity:null"]],
      ["volantis", ["entity:forward"]],
    ]);
  });

  it("refused: AI writes, edits from before the last session, and other campaigns' edits are left out", async () => {
    const g = await game();
    await g.engine.userEditEntity({ entityId: g.volantis.id, patch: { summary: "Old news." }, editKind: "forward" });
    const s2 = await g.engine.openCampaign(g.campaign.id); // reports the edit above
    if (!s2.ok) throw new Error();
    expect(s2.value.changes).toHaveLength(1);

    await g.engine.readEntity({ sessionId: s2.value.session.id, ref: "rickard-snow" });
    await g.engine.editEntity({ sessionId: s2.value.session.id, entity: "rickard-snow", sections: [{ key: "wants", body: "AI wrote this." }] });
    const other = await g.storage.createCampaign({ worldId: g.world.id, ownerId: g.user.id, name: "Run 2", approvalMode: "batch" }, USER);
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", campaignId: other.id, heading: "Wants", body: "Other run.", editKind: "retcon" });

    const s3 = await g.engine.openCampaign(g.campaign.id);
    if (!s3.ok) throw new Error();
    expect(s3.value.changes).toEqual([]);
  });
});

describe("Rule: unlogged scenes", () => {
  it("refused: get_context and open_campaign warn while the last scene is unlogged", async () => {
    const g = await game();
    const first = await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    expect(first).toMatchObject({ ok: true, value: { warnings: [] } }); // starts scene 1
    const second = await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    if (!second.ok) throw new Error();
    expect(second.value.warnings[0]).toMatch(/ch-01-s1 was never logged.*log_scene/);
    expect(second.value.scene.id).toBe(first.ok && first.value.scene.id); // no second scene started

    const reopened = await g.engine.openCampaign(g.campaign.id);
    if (!reopened.ok) throw new Error();
    expect(reopened.value.unloggedScene!.number).toBe(1);
    expect(reopened.value.warnings[0]).toMatch(/never logged/);
  });

  it("allowed: once logged, the warning goes away and the next get_context starts a new scene", async () => {
    const g = await game();
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    await g.engine.logScene({ sessionId: g.sessionId, summary: "Done.", present: ["rickard-snow"], updates: [] });
    const next = await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    if (!next.ok) throw new Error();
    expect(next.value.warnings).toEqual([]);
    expect(next.value.scene.number).toBe(2);
    const scenes = g.storage.dump().scenes as { number: number; logged_at: string | null }[];
    expect(scenes.map((sc) => [sc.number, sc.logged_at !== null])).toEqual([
      [1, true],
      [2, false],
    ]);
  });
});

describe("Rule: history", () => {
  it("allowed: every change writes a version, and any version can be restored", async () => {
    const g = await game();
    const wants = g.rickard.sections.find((s) => s.key === "wants")!;
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "A pardon.", editKind: "forward" });
    await g.engine.userEditSection({ entityId: g.rickard.id, key: "wants", body: "Revenge.", editKind: "forward" });
    const [firstEdit] = await g.storage.listVersions({ objectType: "section", objectId: wants.id });
    expect(firstEdit).toMatchObject({ before: { bodyMd: wants.bodyMd }, after: { bodyMd: "A pardon." } });

    expect((await g.engine.restoreVersion(firstEdit!.id, "retcon")).ok).toBe(true);
    expect((await g.storage.getSection(wants.id))!.bodyMd).toBe("A pardon.");
    const history = await g.storage.listVersions({ objectType: "section", objectId: wants.id });
    expect(history.map((v) => v.editKind)).toEqual(["forward", "forward", "retcon"]);
    expect(history.at(-1)!.reason).toBe(`restored version ${firstEdit!.id}`);

    // an entity can be restored to its state at creation
    await g.engine.userEditEntity({ entityId: g.volantis.id, patch: { summary: "Burning." }, editKind: "forward" });
    const [created] = await g.storage.listVersions({ objectType: "entity", objectId: g.volantis.id });
    await g.engine.restoreVersion(created!.id, "retcon");
    expect((await g.storage.getEntity(g.volantis.id))!.summary).toBe("The oldest Free City.");
  });

  it("refused: nothing is hard-deleted; rejected and retconned updates stay as records", async () => {
    const g = await game("batch");
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    const a = await logOne(g, fact({ body: "Rejected." }));
    const b = await logOne(g, fact({ body: "Retconned." }));
    if (!a.ok || !b.ok) throw new Error();
    await g.engine.setUpdateStatus(a.update.id, "rejected");
    await g.engine.setUpdateStatus(b.update.id, "retconned");
    expect((await g.storage.listUpdates(g.campaign.id)).map((u) => u.status)).toEqual(["rejected", "retconned"]);
    // and they no longer show in context
    const ctx = await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    if (!ctx.ok) throw new Error();
    expect(ctx.value.entities[0]!.items.some((i) => i.kind === "update")).toBe(false);
  });

  it("refused: restoring an unknown version changes nothing", async () => {
    const g = await game();
    await expectRefusedNoChange(g.storage, "not_found", () => g.engine.restoreVersion("nope", "retcon"));
  });
});

describe("Acceptance: a write refused by a rule changes nothing in storage", () => {
  it("log_scene with an unknown present entity writes no scene, update, knowledge or version", async () => {
    const g = await game();
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    await expectRefusedNoChange(g.storage, "unknown_reference", () =>
      g.engine.logScene({ sessionId: g.sessionId, summary: "x", present: ["rickard-snow", "Nobody"], updates: [fact()] }),
    );
  });

  it("a partly refused log_scene stores the accepted updates and nothing at all of the refused ones", async () => {
    const g = await game();
    await g.engine.getContext({ sessionId: g.sessionId, present: ["rickard-snow"] });
    const r = await g.engine.logScene({
      sessionId: g.sessionId,
      summary: "Retreat.",
      present: ["rickard-snow"],
      updates: [fact({ body: "Kept." }), fact({ entities: ["golden-company"], body: "Unread entity.", knows: ["volantis"] })],
    });
    if (!r.ok) throw new Error();
    expect(r.value.results.map((x) => x.ok)).toEqual([true, false]);
    const stored = await g.storage.listUpdates(g.campaign.id);
    expect(stored.map((u) => u.bodyMd)).toEqual(["Kept."]);
    const dump = g.storage.dump();
    expect(dump.knowledge).toEqual([]);
    expect((dump.versions as { object_type: string }[]).filter((v) => v.object_type === "update")).toHaveLength(1);
  });

  it("an edit with one locked section among several writes none of them", async () => {
    const g = await game();
    await g.engine.readEntity({ sessionId: g.sessionId, ref: "rickard-snow" });
    await expectRefusedNoChange(g.storage, "locked_by_user", () =>
      g.engine.editEntity({
        sessionId: g.sessionId,
        entity: "rickard-snow",
        summary: "Changed.",
        sections: [{ key: "wants", body: "ok" }, { key: "appearance", body: "locked!" }],
      }),
    );
  });
});
