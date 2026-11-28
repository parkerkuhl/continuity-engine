// UX review #18: a user's save doesn't silently overwrite a GM change made while they were editing.
import { describe, expect, it } from "vitest";
import { RulesEngine } from "../src";
import { AI, seed, setup } from "./helpers";

describe("UX #18: edits started before a GM change are refused as stale", () => {
  it("refuses a section save whose starting text is no longer stored, and writes nothing", async () => {
    const { storage, world } = await setup();
    const { rickard } = await seed(storage, world.id);
    const engine = new RulesEngine(storage);
    const started = (await storage.getPage(rickard.id))!.sections.find((s) => s.key === "wants")!;
    // the GM writes while the user is still typing
    await storage.updateSection(started.id, { bodyMd: "Revenge." }, AI);
    const before = (await storage.listVersions()).length;
    const r = await engine.userEditSection({ entityId: rickard.id, key: "wants", body: "Mine.", editKind: "forward", expectedBody: started.bodyMd });
    expect(!r.ok && r.refusal.rule).toBe("stale");
    expect((await storage.listVersions()).length).toBe(before);
    // choosing "Keep mine" sends the GM's text as the new starting point
    const ok = await engine.userEditSection({ entityId: rickard.id, key: "wants", body: "Mine.", editKind: "forward", expectedBody: "Revenge." });
    expect(ok.ok && ok.value.bodyMd).toBe("Mine.");
  });

  it("does the same for the summary", async () => {
    const { storage, world } = await setup();
    const { rickard } = await seed(storage, world.id);
    const engine = new RulesEngine(storage);
    await storage.updateEntity(rickard.id, { summary: "Dead." }, AI);
    const r = await engine.userEditEntity({ entityId: rickard.id, patch: { summary: "Alive." }, editKind: "retcon", expectedSummary: rickard.summary });
    expect(!r.ok && r.refusal.rule).toBe("stale");
    expect((await engine.userEditEntity({ entityId: rickard.id, patch: { summary: "Alive." }, editKind: "retcon", expectedSummary: "Dead." })).ok).toBe(true);
  });
});
