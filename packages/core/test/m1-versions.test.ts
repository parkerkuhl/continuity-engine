// Milestone 1 acceptance: "Every write produces exactly one versions row".
import { describe, expect, it } from "vitest";
import { SqliteStorage, type Storage } from "../src";
import { AI, USER, seed, setup } from "./helpers";

type Ctx = Awaited<ReturnType<typeof setup>> & Awaited<ReturnType<typeof seed>>;
type WriteCase = { method: keyof Storage; run: (c: Ctx) => Promise<{ id: string }>; objectType: string };

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
    method: "updateSection",
    objectType: "section",
    run: (c) => c.storage.updateSection(c.rickard.sections[0]!.id, { bodyMd: "Shorter than he claims." }, { author: "user", editKind: "retcon" }),
  },
];

async function ctx(): Promise<Ctx> {
  const base = await setup();
  return { ...base, ...(await seed(base.storage, base.world.id)) };
}

describe("M1: every write produces exactly one versions row", () => {
  it("the table below covers every write method on Storage", () => {
    const writeMethods = Object.getOwnPropertyNames(SqliteStorage.prototype).filter((m) => /^(create|update|add|set|delete|remove)/.test(m));
    expect(writeMethods.sort()).toEqual(WRITES.map((w) => w.method).sort());
  });

  it.each(WRITES)("$method writes one $objectType version", async ({ run, objectType }) => {
    const c = await ctx();
    const before = (await c.storage.listVersions()).length;
    const result = await run(c);
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
    const c = await ctx(); // createUser + createWorld + 4 createEntity
    expect((await c.storage.listVersions()).length).toBe(6);
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
