// Milestone 1 acceptance: "Every write produces exactly one versions row".
import { describe, expect, it } from "vitest";
import { PgStorage, SqliteStorage, type Storage } from "../src";
import { AI, USER, seed, setup } from "./helpers";

type Ctx = Awaited<ReturnType<typeof setup>> & Awaited<ReturnType<typeof seed>>;
type WriteCase = {
  method: keyof Storage;
  objectType: string;
  /** Setup that runs before the version count is taken. */
  prepare?: (c: Ctx) => Promise<{ id: string }>;
  run: (c: Ctx, prepared: { id: string }) => Promise<{ id: string }>;
};

const WRITES: WriteCase[] = [
  { method: "createUser", objectType: "user", run: (c) => c.storage.createUser({ name: "Sam" }, USER) },
  {
    method: "createWorld",
    objectType: "world",
    run: (c) => c.storage.createWorld({ ownerId: c.user.id, name: "W2", depth: "full", defaultApprovalMode: "review" }, USER),
  },
  { method: "updateWorld", objectType: "world", run: (c) => c.storage.updateWorld(c.world.id, { pitch: "New pitch" }, USER) },
  {
    method: "createCampaign",
    objectType: "campaign",
    run: (c) => c.storage.createCampaign({ worldId: c.world.id, ownerId: c.user.id, name: "Run", approvalMode: "autopilot" }, USER),
  },
  {
    method: "createEntity",
    objectType: "entity",
    run: (c) =>
      c.storage.createEntity(
        { worldId: c.world.id, type: "item", name: "Valyrian dagger", source: "invention", sections: [{ heading: "Origin", bodyMd: "?" }, { heading: "Owner", bodyMd: "?" }] },
        AI,
      ),
  },
  { method: "updateEntity", objectType: "entity", run: (c) => c.storage.updateEntity(c.rickard.id, { summary: "Healed." }, AI) },
  { method: "addSection", objectType: "section", run: (c) => c.storage.addSection(c.volantis.id, { heading: "Districts", bodyMd: "Two." }, AI) },
  {
    method: "addSectionKnowers",
    objectType: "section",
    run: async (c) => {
      const id = c.rickard.sections[0]!.id;
      await c.storage.addSectionKnowers(id, [c.volantis.id], AI);
      return { id };
    },
  },
  {
    method: "updateSection",
    objectType: "section",
    run: (c) => c.storage.updateSection(c.rickard.sections[0]!.id, { bodyMd: "Shorter than he claims." }, { author: "user", editKind: "retcon" }),
  },
  {
    method: "updateCampaign",
    objectType: "campaign",
    run: async (c) => c.storage.updateCampaign((await camp(c)).id, { spoilersOn: true }, USER),
  },
  {
    method: "createUpdate",
    objectType: "update",
    run: async (c) =>
      c.storage.createUpdate(
        { campaignId: (await camp(c)).id, entityIds: [c.rickard.id], tags: ["ch-01"], type: "status-change", severity: "minor", status: "confirmed", bodyMd: "Limps.", knows: [c.rickard.id] },
        AI,
      ),
  },
  {
    method: "updateUpdate",
    objectType: "update",
    prepare: async (c) =>
      c.storage.createUpdate(
        { campaignId: (await camp(c)).id, entityIds: [], tags: [], type: "new-fact", severity: "minor", status: "proposed", bodyMd: "x" },
        AI,
      ),
    run: (c, u) => c.storage.updateUpdate(u.id, { status: "confirmed" }, USER),
  },
  {
    method: "createRuling",
    objectType: "ruling",
    run: (c) => c.storage.createRuling({ worldId: c.world.id, text: "Dragons are extinct.", origin: "in_play" }, USER),
  },
  {
    method: "createScene",
    objectType: "scene",
    run: async (c) => c.storage.createScene({ campaignId: (await camp(c)).id, chapter: 1 }, AI),
  },
  {
    method: "updateScene",
    objectType: "scene",
    prepare: async (c) => c.storage.createScene({ campaignId: (await camp(c)).id, chapter: 1 }, AI),
    run: (c, scene) => c.storage.updateScene(scene.id, { loggedAt: new Date().toISOString() }, AI),
  },
  { method: "createThread", objectType: "thread", run: async (c) => c.storage.createThread({ campaignId: (await camp(c)).id, title: "The debt" }, AI) },
  {
    method: "updateThread",
    objectType: "thread",
    prepare: async (c) => c.storage.createThread({ campaignId: (await camp(c)).id, title: "The debt" }, AI),
    run: (c, t) => c.storage.updateThread(t.id, { state: "resolved" }, AI),
  },
  {
    method: "createChapter",
    objectType: "chapter",
    run: async (c) => c.storage.createChapter({ campaignId: (await camp(c)).id, number: 1, title: "Siege", summaryMd: "x" }, AI),
  },
  {
    method: "createGmNote",
    objectType: "gm_note",
    run: async (c) =>
      c.storage.createGmNote({ campaignId: (await camp(c)).id, kind: "clock", key: "siege", bodyMd: "", data: { step: 0, steps: 4, advances_on: "x" } }, AI),
  },
  {
    method: "updateGmNote",
    objectType: "gm_note",
    prepare: async (c) => c.storage.createGmNote({ campaignId: (await camp(c)).id, kind: "twist", key: "traitor", bodyMd: "a", data: null }, AI),
    run: (c, n) => c.storage.updateGmNote(n.id, { bodyMd: "b" }, AI),
  },
  {
    method: "setVoiceAnchor",
    objectType: "voice_anchor",
    run: async (c) => {
      const id = (await camp(c)).id;
      await c.storage.setVoiceAnchor({ campaignId: id, sampleVerbatim: "s", profileMd: "p", interiorLevel: "high", avoidList: [], voiceRulings: [], scenesSinceAudit: 0 }, USER);
      return { id };
    },
  },
  {
    method: "setPcSheet",
    objectType: "pc_sheet",
    run: async (c) => {
      const id = (await camp(c)).id;
      await c.storage.setPcSheet({ campaignId: id, data: { name: "Rickard Snow" } }, USER);
      return { id };
    },
  },
];

/** Session and read bookkeeping: not content changes, so no versions row (see CLAUDE.md). */
/** Private helpers on the class that TypeScript hides but the prototype still lists. */
const PRIVATE = ["stamp", "write", "scope", "sectionsOf", "newSectionRow", "refreshFts"];
const BOOKKEEPING = ["openSession", "closeSession", "recordReads"];
const READ_ONLY = /^(get|list|has|resolve|search|dump|close$)/;

async function camp(c: Ctx) {
  return (await c.storage.listCampaigns(c.world.id))[0]!;
}

async function ctx(): Promise<Ctx> {
  const base = await setup();
  const seeded = await seed(base.storage, base.world.id);
  await base.storage.createCampaign({ worldId: base.world.id, ownerId: base.user.id, name: "Run", approvalMode: "batch" }, USER);
  return { ...base, ...seeded };
}

describe("M1: every write produces exactly one versions row", () => {
  it.each([
    ["SqliteStorage", SqliteStorage],
    ["PgStorage", PgStorage],
  ])("the table below covers every write method on %s", (_name, impl) => {
    const methods = Object.getOwnPropertyNames(impl.prototype).filter((m) => m !== "constructor" && !m.startsWith("require"));
    const writes = methods.filter((m) => !READ_ONLY.test(m) && !BOOKKEEPING.includes(m) && !PRIVATE.includes(m));
    expect(writes.sort()).toEqual(WRITES.map((w) => w.method).sort());
  });

  it("session and read bookkeeping writes no versions rows", async () => {
    const c = await ctx();
    const campaign = await camp(c);
    const before = (await c.storage.listVersions()).length;
    const { session } = await c.storage.openSession(campaign.id);
    await c.storage.recordReads(session.id, [c.rickard.id]);
    await c.storage.closeSession(session.id);
    expect((await c.storage.listVersions()).length).toBe(before);
  });

  it.each(WRITES)("$method writes one $objectType version", async ({ prepare, run, objectType }) => {
    const c = await ctx();
    const prepared = prepare ? await prepare(c) : { id: "" };
    const before = (await c.storage.listVersions()).length;
    const result = await run(c, prepared);
    const after = await c.storage.listVersions();
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)).toMatchObject({ objectType, objectId: result.id });
  });

  it("records before, after, author, edit kind and reason", async () => {
    const c = await ctx();
    const sec = c.rickard.sections[0]!;
    await c.storage.updateSection(sec.id, { bodyMd: "Shorter." }, { author: "user", editKind: "forward", reason: "lost weight" });
    const [v] = await c.storage.listVersions({ objectType: "section", objectId: sec.id });
    expect(v).toMatchObject({
      author: "user",
      editKind: "forward",
      reason: "lost weight",
      before: { bodyMd: sec.bodyMd },
      after: { bodyMd: "Shorter." },
    });
  });

  it("a create stores the whole page, sections included, in its one version", async () => {
    const c = await ctx();
    const [v] = await c.storage.listVersions({ objectType: "entity", objectId: c.rickard.id });
    expect(v!.before).toBeNull();
    expect((v!.after as { sections: unknown[] }).sections).toHaveLength(3);
  });

  it("seeding writes exactly one version per write call", async () => {
    const c = await ctx(); // createUser + createWorld + 4 createEntity + createCampaign
    expect((await c.storage.listVersions()).length).toBe(7);
  });

  it("a failed write writes no version and changes nothing", async () => {
    const c = await ctx();
    const snapshot = async () => ({
      versions: await c.storage.listVersions(),
      entities: await c.storage.listEntities(c.world.id),
      page: await c.storage.getPage(c.rickard.id),
    });
    const before = await snapshot();
    await expect(c.storage.createEntity({ worldId: c.world.id, type: "character", name: "Rickard Snow", source: "canon" }, AI)).rejects.toThrow();
    await expect(c.storage.updateEntity("missing", { summary: "x" }, AI)).rejects.toThrow(/not found/);
    await expect(c.storage.updateSection(c.rickard.sections[0]!.id, { bodyMd: "a\n## b" }, AI)).rejects.toThrow();
    await expect(c.storage.addSection(c.rickard.id, { heading: "Wants", bodyMd: "dup" }, AI)).rejects.toThrow(/already exists/);
    await expect(c.storage.updateWorld(c.world.id, { depth: "huge" as "full" }, USER)).rejects.toThrow();
    await expect(
      c.storage.createCampaign({ worldId: "missing", ownerId: c.user.id, name: "x", approvalMode: "review" }, USER),
    ).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });
});
