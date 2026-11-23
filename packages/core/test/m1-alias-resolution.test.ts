// Milestone 1 acceptance: "Tests create a world, entities with aliases, and sections;
// an alias resolves to its canonical slug". Also covers FTS5 search.
import { describe, expect, it } from "vitest";
import { AI, USER, seed, setup } from "./helpers";

describe("M1: world, entities with aliases, and sections", () => {
  it("stores a world with entities, aliases and ordered sections", async () => {
    const { storage, world } = await setup();
    const { rickard } = await seed(storage, world.id);

    expect(await storage.getWorld(world.id)).toMatchObject({ name: "The Free Cities", depth: "compact" });
    const page = await storage.getPage(rickard.id);
    expect(page).toMatchObject({ slug: "rickard-snow", aliases: ["Snow", "the bastard sellsword", "Commander"] });
    expect(page!.sections.map((s) => [s.key, s.order, s.visibility, s.lockedByUser])).toEqual([
      ["appearance", 0, "public", true],
      ["wants", 1, "public", false],
      ["hiding", 2, "secret", false],
    ]);
    expect((await storage.listEntities(world.id)).map((e) => e.slug)).toEqual([
      "rickard-snow", // character
      "glossary", // concept
      "golden-company", // faction
      "volantis", // place
    ]);
  });

  it("rejects a second entity with the same slug in a world", async () => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    await expect(
      storage.createEntity({ worldId: world.id, type: "character", name: "Rickard Snow", source: "invention" }, AI),
    ).rejects.toThrow(/already exists/);
  });

  it("rejects sections with a reserved or duplicate key, or a ## heading in the body", async () => {
    const { storage, world } = await setup();
    const base = { worldId: world.id, type: "item" as const, name: "Sword", source: "invention" as const };
    await expect(storage.createEntity({ ...base, sections: [{ heading: "Summary", bodyMd: "x" }] }, AI)).rejects.toThrow(/reserved/);
    await expect(
      storage.createEntity({ ...base, sections: [{ heading: "A", bodyMd: "x" }, { heading: "a", bodyMd: "y" }] }, AI),
    ).rejects.toThrow(/twice/);
    await expect(storage.createEntity({ ...base, sections: [{ heading: "A", bodyMd: "x\n## B\ny" }] }, AI)).rejects.toThrow(/level-2/);
    // ## inside a code fence is fine
    await storage.createEntity({ ...base, sections: [{ heading: "A", bodyMd: "```md\n## not a heading\n```" }] }, AI);
  });
});

describe("M1: alias resolution", () => {
  it.each([
    ["rickard-snow", "slug"],
    ["Rickard Snow", "slug"],
    ["  rickard   SNOW ", "slug"],
    ["Snow", "alias"],
    ["the bastard sellsword", "alias"],
    ["The Bastard Sellsword", "alias"],
    ["the-bastard-sellsword", "alias"],
    ["COMMANDER", "alias"],
  ])("%s resolves to rickard-snow (matched on %s)", async (ref, on) => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    const r = await storage.resolveEntity(world.id, ref);
    expect(r).toMatchObject({ status: "resolved", matchedOn: on, entity: { slug: "rickard-snow" } });
  });

  it("matches a name when the slug differs from it", async () => {
    const { storage, world } = await setup();
    await storage.createEntity({ worldId: world.id, type: "place", slug: "red-keep", name: "The Red Keep", source: "canon" }, AI);
    expect(await storage.resolveEntity(world.id, "the red keep")).toMatchObject({ status: "resolved", matchedOn: "name", entity: { slug: "red-keep" } });
  });

  it("resolves an entity id", async () => {
    const { storage, world } = await setup();
    const { volantis } = await seed(storage, world.id);
    expect(await storage.resolveEntity(world.id, volantis.id)).toMatchObject({ status: "resolved", matchedOn: "id" });
  });

  it("refuses an unknown reference with the closest matches and creates nothing", async () => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    const before = await storage.listEntities(world.id);
    const r = await storage.resolveEntity(world.id, "Rikard Snow");
    expect(r.status).toBe("unknown");
    if (r.status !== "unknown") throw new Error();
    expect(r.suggestions[0]!.slug).toBe("rickard-snow");
    expect(await storage.listEntities(world.id)).toEqual(before);
  });

  it("returns no suggestions for something far from every name", async () => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    expect(await storage.resolveEntity(world.id, "xyzzy")).toEqual({ status: "unknown", ref: "xyzzy", suggestions: [] });
  });

  it("reports ambiguity when an alias belongs to two entities", async () => {
    const { storage, world } = await setup();
    await seed(storage, world.id);
    await storage.createEntity(
      { worldId: world.id, type: "character", name: "Jon Snow", aliases: ["Snow"], source: "invention" },
      AI,
    );
    const r = await storage.resolveEntity(world.id, "snow");
    expect(r.status).toBe("ambiguous");
    if (r.status !== "ambiguous") throw new Error();
    expect(r.candidates.map((e) => e.slug).sort()).toEqual(["jon-snow", "rickard-snow"]);
    // the full name still resolves uniquely
    expect(await storage.resolveEntity(world.id, "Jon Snow")).toMatchObject({ status: "resolved", entity: { slug: "jon-snow" } });
  });

  it("resolves campaign-only entities only within that campaign", async () => {
    const { storage, user, world } = await setup();
    await seed(storage, world.id);
    const campaign = await storage.createCampaign({ worldId: world.id, ownerId: user.id, name: "Run 1", approvalMode: "mixed" }, USER);
    await storage.createEntity(
      { worldId: world.id, campaignId: campaign.id, type: "character", name: "Marro", aliases: ["the squire"], source: "invention" },
      AI,
    );
    expect((await storage.resolveEntity(world.id, "the squire")).status).toBe("unknown");
    expect(await storage.resolveEntity(world.id, "the squire", { campaignId: campaign.id })).toMatchObject({
      status: "resolved",
      entity: { slug: "marro" },
    });
  });

  it("follows alias edits", async () => {
    const { storage, world } = await setup();
    const { volantis } = await seed(storage, world.id);
    await storage.updateEntity(volantis.id, { aliases: ["Old Volantis", "the Black Walls"] }, USER);
    expect(await storage.resolveEntity(world.id, "the black walls")).toMatchObject({ status: "resolved", entity: { slug: "volantis" } });
  });
});

describe("M1: full-text search (FTS5)", () => {
  it("finds entities by name, alias, summary and section body, with one-line summaries", async () => {
    const { storage, world } = await setup();
    const { rickard } = await seed(storage, world.id);
    const slugs = async (q: string, type?: "faction") => (await storage.search(world.id, q, { type })).map((h) => h.entity.slug);

    expect(await slugs("bastard")).toEqual(["rickard-snow"]); // alias
    expect(await slugs("Volantis")).toContain("volantis"); // name ranks
    expect((await slugs("Volantis"))[0]).toBe("volantis");
    expect(await slugs("scar jaw")).toEqual(["rickard-snow"]); // section body, all terms
    expect(await slugs("sellsw")).toEqual(expect.arrayContaining(["rickard-snow", "golden-company"])); // prefix
    expect(await slugs("sellsword", "faction")).toEqual(["golden-company"]);
    expect(await slugs("!!!")).toEqual([]);
    const hit = (await storage.search(world.id, "bastard"))[0]!;
    expect(hit.line).toBe(rickard.summary);
  });

  it("stays current after entity and section edits", async () => {
    const { storage, world } = await setup();
    const { rickard } = await seed(storage, world.id);
    const wants = rickard.sections.find((s) => s.key === "wants")!;
    await storage.updateSection(wants.id, { bodyMd: "A pardon from the Triarchs." }, AI);
    expect((await storage.search(world.id, "winter")).length).toBe(0);
    expect((await storage.search(world.id, "triarchs")).map((h) => h.entity.slug)).toEqual(["rickard-snow"]);
    await storage.addSection(rickard.id, { heading: "Debts", bodyMd: "Owes the Iron Bank." }, AI);
    expect((await storage.search(world.id, "iron bank")).map((h) => h.entity.slug)).toEqual(["rickard-snow"]);
  });

  it("is scoped to one world", async () => {
    const { storage, user, world } = await setup();
    await seed(storage, world.id);
    const other = await storage.createWorld({ ownerId: user.id, name: "Other", depth: "full", defaultApprovalMode: "review" }, USER);
    expect(await storage.search(other.id, "volantis")).toEqual([]);
  });
});
