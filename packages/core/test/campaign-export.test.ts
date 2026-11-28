// SPEC "Page format and export layout" + "Data model": a Markdown export (and import) of a whole campaign.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RulesEngine, exportCampaign, importCampaign, readFiles, writeFiles, type Storage } from "../src";
import { AI, USER, openStore, seed, setup } from "./helpers";

/** Everything stored for a campaign, minus generated ids and timestamps, with ids replaced by slugs. */
async function snapshot(storage: Storage, campaignId: string) {
  const c = (await storage.getCampaign(campaignId))!;
  const all = await storage.listEntities(c.worldId, { campaignId });
  const slug = new Map(all.map((e) => [e.id, e.slug]));
  const slugs = (ids: string[]) => ids.map((i) => slug.get(i) ?? `?${i}`);
  const pages = [];
  for (const e of all) {
    const page = (await storage.getPage(e.id, { campaignId }))!;
    const secs = [];
    for (const s of page.sections) {
      secs.push({ layer: s.campaignId ? "campaign" : "world", key: s.key, heading: s.heading, body: s.bodyMd, vis: s.visibility, locked: s.lockedByUser, knows: slugs(await storage.listKnowers("section", s.id)).sort() });
    }
    pages.push({ slug: e.slug, own: e.campaignId === campaignId, type: e.type, name: e.name, aliases: e.aliases, source: e.source, summary: e.summary, status: e.status, secs });
  }
  const scenes = await storage.listScenes(campaignId);
  const sceneOf = new Map(scenes.map((s) => [s.id, `${s.chapter}.${s.number}`]));
  const updates = await storage.listUpdates(campaignId);
  const seqOf = new Map(updates.map((u) => [u.id, u.seq]));
  const ups = [];
  for (const u of updates) {
    ups.push({
      seq: u.seq,
      entities: slugs(u.entityIds),
      tags: u.tags,
      type: u.type,
      severity: u.severity,
      status: u.status,
      storyTime: u.storyTime,
      chapter: u.chapter,
      scene: u.sceneId && sceneOf.get(u.sceneId),
      body: u.bodyMd,
      supersedes: u.supersedesId && seqOf.get(u.supersedesId),
      conflict: u.conflictsWith && (u.conflictsWith.type === "update" ? seqOf.get(u.conflictsWith.id) : (await storage.getSection(u.conflictsWith.id))!.key),
      author: u.author,
      knows: slugs(await storage.listKnowers("update", u.id)).sort(),
    });
  }
  const anchor = await storage.getVoiceAnchor(campaignId);
  return {
    campaign: { name: c.name, settings: c.settings, approvalMode: c.approvalMode, severityPolicy: c.severityPolicy, asOf: c.asOfStoryTime, chapter: c.currentChapter, spoilers: c.spoilersOn },
    pages,
    rulings: (await storage.listRulings(c.worldId, campaignId)).map((r) => [r.text, r.origin]),
    anchor: anchor && { ...anchor, campaignId: undefined },
    pc: (await storage.getPcSheet(campaignId))?.data,
    threads: (await storage.listThreads(campaignId)).map(({ id: _i, campaignId: _c, ...t }) => t),
    chapters: (await storage.listChapters(campaignId)).map(({ id: _i, campaignId: _c, ...ch }) => ch),
    scenes: scenes.map((s) => ({ ch: s.chapter, n: s.number, place: s.placeEntityId && slug.get(s.placeEntityId), present: slugs(s.presentEntityIds), summary: s.summaryMd, logged: s.loggedAt })),
    updates: ups,
    gm: (await storage.listGmNotes(campaignId)).map(({ id: _i, campaignId: _c, ...n }) => n),
  };
}

async function richCampaign() {
  const ctx = await setup();
  const { storage, world, user } = ctx;
  const { rickard, company, volantis } = await seed(storage, world.id);
  const c = await storage.createCampaign(
    {
      worldId: world.id,
      ownerId: user.id,
      name: "Run One: Ashes",
      approvalMode: "mixed",
      severityPolicy: { minor: "autopilot", major: "review" },
      asOfStoryTime: "3rd day after the siege",
      settings: { genre: "grimdark", tone: "bleak, wry", dice: "d20", lines: ["harm to children"], veils: ["torture"] },
    },
    USER,
  );
  await storage.updateCampaign(c.id, { currentChapter: 2, spoilersOn: true }, USER);
  const marro = await storage.createEntity(
    {
      worldId: world.id,
      campaignId: c.id,
      type: "character",
      name: "Marro",
      aliases: ["the surgeon's boy"],
      source: "invention",
      status: "proposed",
      summary: "Camp runner.",
      sections: [
        { heading: "Wants", bodyMd: "Coin.", lockedByUser: true },
        { heading: "Secret", bodyMd: "Spies for the Triarch.", visibility: "secret" },
      ],
    },
    AI,
  );
  const pc = await storage.createEntity({ worldId: world.id, campaignId: c.id, type: "character", name: "Ysolt", source: "invention" }, AI);
  const toPc = await storage.addSection(rickard.id, { campaignId: c.id, key: "to-the-pc", heading: "To the PC", bodyMd: "Old captain" }, AI);
  await storage.addSection(volantis.id, { campaignId: c.id, heading: "Under siege", bodyMd: "Gates shut.\n\n### Inside\nHunger.", visibility: "secret", lockedByUser: true }, USER);
  const hiding = (await storage.getPage(rickard.id))!.sections.find((s) => s.key === "hiding")!;
  await storage.addSectionKnowers(hiding.id, [pc.id], AI);
  const marroSecret = (await storage.getPage(marro.id, { campaignId: c.id }))!.sections.find((s) => s.key === "secret")!;
  await storage.addSectionKnowers(marroSecret.id, [pc.id, rickard.id], AI);

  await storage.createRuling({ worldId: world.id, campaignId: c.id, text: "Magic is rare.\n## not a heading\nReally.", origin: "in_play" }, AI);
  await storage.createRuling({ worldId: world.id, campaignId: c.id, text: "Rickard never lies to the PC.", origin: "user_edit" }, USER);
  await storage.setVoiceAnchor(
    { campaignId: c.id, sampleVerbatim: "The rain came sideways.\n\n## Not a section", profileMd: "Close third, past tense.", interiorLevel: "medium", avoidList: ["em dashes", "purple prose"], voiceRulings: ["Shorter sentences."], scenesSinceAudit: 3 },
    AI,
  );
  await storage.setPcSheet({ campaignId: c.id, data: { name: "Ysolt", stats: { grit: 3 }, health: "wounded", inventory: ["knife", { name: "map", note: "torn: west half" }], bonds: [], flaw_notes: "Proud." } }, AI);

  await storage.createChapter({ campaignId: c.id, number: 1, title: "The Gate", summaryMd: "They came to Volantis.", closedAt: "2026-11-20T10:00:00.000Z" }, AI);
  const s1 = await storage.createScene({ campaignId: c.id, chapter: 1, placeEntityId: volantis.id, presentEntityIds: [pc.id, rickard.id] }, AI);
  await storage.updateScene(s1.id, { summaryMd: "Arrival.", loggedAt: "2026-11-20T09:00:00.000Z" }, AI);
  const s2 = await storage.createScene({ campaignId: c.id, chapter: 2, presentEntityIds: [pc.id] }, AI);

  const t = await storage.createThread({ campaignId: c.id, title: "Find the heir: who?", bodyMd: "Rumours in the camp.", tags: ["ch-01", "rickard-snow"], openedChapter: 1 }, AI);
  await storage.updateThread(t.id, { state: "resolved", resolvedChapter: 2 }, AI);
  await storage.createThread({ campaignId: c.id, title: "Pay the company", openedChapter: 2 }, AI);

  const u1 = await storage.createUpdate(
    { campaignId: c.id, entityIds: [rickard.id, company.id], tags: ["volantis", "ch-01"], type: "status-change", severity: "major", status: "confirmed", storyTime: "3rd day", chapter: 1, sceneId: s1.id, bodyMd: "Rickard took a bolt.\n\n## Not a heading", knows: [marro.id] },
    AI,
  );
  const u2 = await storage.createUpdate({ campaignId: c.id, entityIds: [rickard.id], tags: [], type: "new-fact", severity: "minor", status: "proposed", chapter: 2, sceneId: s2.id, bodyMd: "He limps.", supersedesId: u1.id, conflictsWith: { type: "update", id: u1.id } }, AI);
  await storage.createUpdate({ campaignId: c.id, entityIds: [volantis.id], tags: [], type: "location", severity: "minor", status: "rejected", bodyMd: "Gates open.", conflictsWith: { type: "section", id: toPc.id } }, USER);
  void u2;

  await storage.createGmNote({ campaignId: c.id, kind: "clock", key: "siege-breaks", bodyMd: "When it fills, the city falls.", data: { step: 2, steps: 6, advances_on: "each failed parley, or a fire" } }, AI);
  await storage.createGmNote({ campaignId: c.id, kind: "twist", key: "heir", bodyMd: "Marro is the heir.", data: null }, AI);
  return { ...ctx, campaign: c };
}

describe("Campaign Markdown export and import", () => {
  it("writes the SPEC layout", async () => {
    const { storage, campaign } = await richCampaign();
    const files = await exportCampaign(storage, campaign.id);
    const root = "campaigns/run-one-ashes/";
    const paths = [...files.keys()].filter((p) => p.startsWith(root)).map((p) => p.slice(root.length));
    expect(paths).toEqual([
      "campaign.md",
      "chapters/ch-01.md",
      "chapters/ch-02.md",
      "gm/clock/siege-breaks.md",
      "gm/twist/heir.md",
      "log/0001.md",
      "log/0002.md",
      "log/0003.md",
      "overlays/characters/marro.md",
      "overlays/characters/rickard-snow.md",
      "overlays/characters/ysolt.md",
      "overlays/places/volantis.md",
      "pc.md",
      "rulings.md",
      "threads.md",
      "voice-anchor.md",
    ]);
    expect(files.has("worlds/the-free-cities/00-load-guide.md")).toBe(true);
    expect(files.get(`${root}log/0002.md`)).toBe(
      "---\nseq: 2\nentities: [rickard-snow]\ntags: []\ntype: new-fact\nseverity: minor\nstatus: proposed\nchapter: 2\nscene: ch-02-s1\nsupersedes: 1\nconflicts_with:\n  update: 1\nknows: []\nauthor: ai\n---\nHe limps.\n",
    );
    expect(files.get(`${root}overlays/characters/rickard-snow.md`)).toBe(
      "---\nid: rickard-snow\noverlay: true\nworld_knows:\n  hiding: [ysolt]\n---\n## To the PC\nOld captain\n",
    );
    expect(files.get(`${root}threads.md`)).toContain("## Find the heir: who?  <!-- {state: resolved, tags: [ch-01, rickard-snow], opened: 1, resolved: 2} -->");
    expect(files.get(`${root}rulings.md`)).toContain("\\## not a heading");
  });

  it("export → import → export is identical, and the stored campaign matches", async () => {
    const { storage, campaign, user } = await richCampaign();
    const first = await exportCampaign(storage, campaign.id);
    const imported = await importCampaign(storage, first, { ownerId: user.id, meta: USER });
    expect(imported.world.id).not.toBe(campaign.worldId);
    expect(await exportCampaign(storage, imported.campaign.id)).toEqual(first);
    expect(await snapshot(storage, imported.campaign.id)).toEqual(await snapshot(storage, campaign.id));
  });

  it("round-trips through files on disk into a fresh database", async () => {
    const { storage, campaign } = await richCampaign();
    const files = await exportCampaign(storage, campaign.id);
    const dir = await mkdtemp(join(tmpdir(), "ce-campaign-"));
    await writeFiles(dir, files);
    const fresh = await openStore();
    const user = await fresh.createUser({ name: "P" }, USER);
    const imported = await importCampaign(fresh, await readFiles(dir), { ownerId: user.id, meta: USER });
    expect(await exportCampaign(fresh, imported.campaign.id)).toEqual(files);
    expect(await snapshot(fresh, imported.campaign.id)).toEqual(await snapshot(storage, campaign.id));
  });

  it("imports into an existing world, ignoring the bundled world folder", async () => {
    const { storage, campaign, user, world } = await richCampaign();
    const files = await exportCampaign(storage, campaign.id);
    // the campaign's own pages are unique per world, so they must not exist there yet
    const other = await storage.createWorld({ ownerId: user.id, name: "Copy", depth: "compact", defaultApprovalMode: "batch" }, USER);
    await seed(storage, other.id);
    const imported = await importCampaign(storage, files, { ownerId: user.id, meta: USER, worldId: other.id });
    expect(imported.world.id).toBe(other.id);
    expect((await storage.listWorlds()).length).toBe(2);
    const a = await snapshot(storage, campaign.id);
    const b = await snapshot(storage, imported.campaign.id);
    expect(b).toEqual(a);
    void world;
  });

  it("refuses a campaign page that is already in the target world, writing nothing", async () => {
    const { storage, campaign, user, world } = await richCampaign();
    const files = await exportCampaign(storage, campaign.id);
    const before = (await storage.listVersions()).length;
    await expect(importCampaign(storage, files, { ownerId: user.id, meta: USER, worldId: world.id })).rejects.toThrow(/"marro" is already a page in this world/);
    expect((await storage.listVersions()).length).toBe(before);
  });

  it("refuses an unknown page reference before writing anything", async () => {
    const { storage, campaign, user } = await richCampaign();
    const files = await exportCampaign(storage, campaign.id);
    const p = "campaigns/run-one-ashes/log/0002.md";
    files.set(p, files.get(p)!.replace("entities: [rickard-snow]", "entities: [rikard]"));
    const before = (await storage.listVersions()).length;
    await expect(importCampaign(storage, files, { ownerId: user.id, meta: USER })).rejects.toThrow(/0002\.md.*"rikard" is not a page/);
    expect((await storage.listVersions()).length).toBe(before);
    expect((await storage.listWorlds()).length).toBe(1);
  });

  it("refuses files outside the layout and a missing scene", async () => {
    const { storage, campaign, user } = await richCampaign();
    const files = await exportCampaign(storage, campaign.id);
    const stray = new Map(files).set("campaigns/run-one-ashes/notes.md", "hi");
    await expect(importCampaign(storage, stray, { ownerId: user.id, meta: USER })).rejects.toThrow(/notes\.md: not part of the campaign layout/);
    const p = "campaigns/run-one-ashes/log/0001.md";
    const bad = new Map(files).set(p, files.get(p)!.replace("scene: ch-01-s1", "scene: ch-09-s1"));
    await expect(importCampaign(storage, bad, { ownerId: user.id, meta: USER })).rejects.toThrow(/scene ch-09-s1 is not in chapters/);
  });

  it("the engine exports and imports as the user, scoped like world export", async () => {
    const { storage, campaign } = await richCampaign();
    const engine = new RulesEngine(storage);
    const out = await engine.exportCampaign(campaign.id);
    expect(out.ok).toBe(true);
    const r = await engine.importCampaign(out.ok ? out.value : new Map());
    expect(r.ok && r.value.campaign.name).toBe("Run One: Ashes");
    expect((await engine.exportCampaign("nope")).ok).toBe(false);
    const bad = await engine.importCampaign(new Map([["x.md", "y"]]));
    expect(!bad.ok && bad.refusal.rule).toBe("invalid");
    void AI;
  });
});
