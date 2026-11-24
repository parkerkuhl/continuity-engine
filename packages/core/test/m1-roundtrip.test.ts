// Milestone 1 acceptance: "Export then import of a world round-trips with no differences".
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportWorld, importWorld, readFiles, writeFiles, type Storage } from "../src";
import { AI, USER, seed, setup } from "./helpers";

/** Everything stored for a world's canon, minus generated ids, with ids replaced by slugs. */
async function snapshot(storage: Storage, worldId: string) {
  const { id: _id, ownerId: _o, ...world } = (await storage.getWorld(worldId))!;
  const entities = [];
  for (const e of await storage.listEntities(worldId)) {
    const { id: _eid, worldId: _w, sections, ...rest } = (await storage.getPage(e.id))!;
    entities.push({
      ...rest,
      sections: sections.map(({ id: _sid, entityId: _eid2, ...s }) => s),
    });
  }
  return { world, entities };
}

async function richWorld() {
  const ctx = await setup();
  const { storage, world } = ctx;
  await seed(storage, world.id);
  await storage.createEntity(
    {
      worldId: world.id,
      type: "concept",
      name: "Timeline",
      source: "canon",
      summary: "Dates are AC.\nSecond summary line.",
      sections: [
        { heading: "Before the Doom", bodyMd: "```md\n## not a section\n```\n\nThen the Doom came." },
        { heading: "Present day", key: "as-of", bodyMd: "3rd day after the siege." },
      ],
    },
    AI,
  );
  await storage.createEntity(
    { worldId: world.id, type: "rule", name: "Blood magic", source: "unverified", sections: [{ heading: "Cost", bodyMd: "A life.", visibility: "secret" }] },
    AI,
  );
  await storage.createEntity({ worldId: world.id, type: "event", name: "The Siege", aliases: [], source: "invention" }, AI);
  await storage.createEntity(
    { worldId: world.id, type: "item", name: "Lady Forlorn", aliases: ["the sword: \"Forlorn\"", "épée"], source: "canon", summary: "Valyrian steel: [rare]" },
    AI,
  );
  await storage.createEntity({ worldId: world.id, type: "character", name: "Zoë Qhorin", aliases: ["#1 'Zo'"], source: "ruling" }, AI);
  // a campaign-only entity and a campaign overlay are not world canon, so they stay out of the world export
  const campaign = await storage.createCampaign({ worldId: world.id, ownerId: ctx.user.id, name: "Run 1", approvalMode: "batch" }, USER);
  await storage.createEntity({ worldId: world.id, campaignId: campaign.id, type: "character", name: "Marro", source: "invention" }, AI);
  const volantis = (await storage.getEntityBySlug(world.id, "volantis"))!;
  await storage.addSection(volantis.id, { campaignId: campaign.id, heading: "Under siege", bodyMd: "Gates shut." }, AI);
  return ctx;
}

describe("M1: Markdown export and import", () => {
  it("export → import → export is identical, file for file", async () => {
    const { storage, user, world } = await richWorld();
    const first = await exportWorld(storage, world.id);
    const imported = await importWorld(storage, first, { ownerId: user.id, meta: USER });
    const second = await exportWorld(storage, imported.id);
    expect([...second.keys()]).toEqual([...first.keys()]);
    for (const [path, content] of first) expect(second.get(path), path).toBe(content);
  });

  it("the imported world stores the same data as the original", async () => {
    const { storage, user, world } = await richWorld();
    const imported = await importWorld(storage, await exportWorld(storage, world.id), { ownerId: user.id, meta: USER });
    expect(await snapshot(storage, imported.id)).toEqual(await snapshot(storage, world.id));
  });

  it("round-trips through files on disk into a fresh database", async () => {
    const { storage, world } = await richWorld();
    const files = await exportWorld(storage, world.id);
    const dir = await mkdtemp(join(tmpdir(), "ce-export-"));
    await writeFiles(dir, files);

    const fresh = await setup();
    const imported = await importWorld(fresh.storage, await readFiles(dir), { ownerId: fresh.user.id, meta: USER });
    expect(await exportWorld(fresh.storage, imported.id)).toEqual(files);
    expect(await snapshot(fresh.storage, imported.id)).toEqual(await snapshot(storage, world.id));
  });

  it("uses the spec's layout and page format", async () => {
    const { storage, world } = await richWorld();
    const files = await exportWorld(storage, world.id);
    expect([...files.keys()]).toEqual([
      "worlds/the-free-cities/00-load-guide.md",
      "worlds/the-free-cities/characters/rickard-snow.md",
      "worlds/the-free-cities/characters/zoe-qhorin.md",
      "worlds/the-free-cities/events/the-siege.md",
      "worlds/the-free-cities/factions/golden-company.md",
      "worlds/the-free-cities/glossary.md",
      "worlds/the-free-cities/items/lady-forlorn.md",
      "worlds/the-free-cities/places/volantis.md",
      "worlds/the-free-cities/setting/blood-magic.md",
      "worlds/the-free-cities/timeline.md",
    ]);
    expect(files.get("worlds/the-free-cities/characters/rickard-snow.md")).toBe(
      [
        "---",
        "id: rickard-snow",
        "type: character",
        "name: Rickard Snow",
        "aliases: [Snow, the bastard sellsword, Commander]",
        "source: invention",
        "locked_sections: [appearance]",
        "---",
        "## Summary",
        "Sellsword captain, Golden Company, outside Volantis. Wounded left shoulder (ch-12).",
        "",
        "## Appearance",
        "Tall, grey-eyed, a burn scar along the jaw.",
        "",
        "## Wants",
        "Land of his own.",
        "",
        "### Short term",
        "Pay the company before winter.",
        "",
        "## Hiding  <!-- visibility: secret -->",
        "His mother's name, and why it matters in Volantis.",
        "",
      ].join("\n"),
    );
    const guide = files.get("worlds/the-free-cities/00-load-guide.md")!;
    expect(guide).toContain("default_approval_mode: batch");
    expect(guide).toContain("- [Rickard Snow](characters/rickard-snow.md): Sellsword captain");
    expect(guide).not.toContain("Marro");
    expect(files.get("worlds/the-free-cities/places/volantis.md")).not.toContain("Under siege");
  });

  it("a malformed export is refused before anything is written", async () => {
    const { storage, user, world } = await richWorld();
    const files = await exportWorld(storage, world.id);
    files.set("worlds/the-free-cities/items/bad.md", "---\nid: Bad Slug\ntype: item\nname: Bad\nsource: canon\n---\n");
    const worldsBefore = await storage.listWorlds();
    const versionsBefore = (await storage.listVersions()).length;
    await expect(importWorld(storage, files, { ownerId: user.id, meta: USER })).rejects.toThrow(/bad\.md/);
    expect(await storage.listWorlds()).toEqual(worldsBefore);
    expect((await storage.listVersions()).length).toBe(versionsBefore);
  });

  it("refuses two pages with the same id", async () => {
    const { storage, user, world } = await richWorld();
    const files = await exportWorld(storage, world.id);
    files.set("worlds/the-free-cities/places/copy.md", files.get("worlds/the-free-cities/places/volantis.md")!);
    await expect(importWorld(storage, files, { ownerId: user.id, meta: USER })).rejects.toThrow(/also used by/);
  });
});
