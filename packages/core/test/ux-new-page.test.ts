// UX review #5: a page the user creates by hand in the web app.
import { describe, expect, it } from "vitest";
import { RulesEngine } from "../src";
import { setup } from "./helpers";

describe("UX #5: New page from the web app", () => {
  it("is confirmed at once, written as the user, and refused when the name is taken", async () => {
    const base = await setup();
    const engine = new RulesEngine(base.storage);
    const w = await engine.createWorld({ name: "Saltmarch", pitch: "", depth: "compact", approvalMode: "review" });
    if (!w.ok) throw new Error(w.refusal.message);

    const r = await engine.userCreateEntity({ worldId: w.value.id, type: "character", name: "Old Ivo", aliases: ["the Ferryman"], source: "canon", summary: "Drowned twice." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Review mode would make a page Claude drafts proposed; the user's own page is canon straight away.
    expect(r.value.status).toBe("confirmed");
    const versions = await base.storage.listVersions({ objectType: "entity", objectId: r.value.id });
    expect(versions).toHaveLength(1);
    expect(versions[0]!.author).toBe("user");

    const dup = await engine.userCreateEntity({ worldId: w.value.id, type: "character", name: "The Ferryman", source: "canon" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.refusal.rule).toBe("duplicate");
  });
});
