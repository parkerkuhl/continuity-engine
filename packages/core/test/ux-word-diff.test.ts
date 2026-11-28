import { describe, expect, it } from "vitest";
import { wordDiff } from "../src/diff";

describe("UX #9: word-level diff", () => {
  it("marks only the changed word", () => {
    expect(wordDiff("Owes 60 crowns to Sabin.", "Owes 80 crowns to Sabin.")).toEqual([
      { op: "same", text: "Owes " },
      { op: "del", text: "60" },
      { op: "add", text: "80" },
      { op: "same", text: " crowns to Sabin." },
    ]);
  });

  it("rebuilds both texts from the parts", () => {
    const a = "The lamp burns blue when the Fogwright is near the harbour.";
    const b = "The lamp burns green when the Fogwright walks near the old harbour at night.";
    const parts = wordDiff(a, b);
    expect(parts.filter((p) => p.op !== "add").map((p) => p.text).join("")).toBe(a);
    expect(parts.filter((p) => p.op !== "del").map((p) => p.text).join("")).toBe(b);
  });

  it("handles empty sides", () => {
    expect(wordDiff("", "New text")).toEqual([{ op: "add", text: "New text" }]);
    expect(wordDiff("Old", "")).toEqual([{ op: "del", text: "Old" }]);
    expect(wordDiff("", "")).toEqual([]);
  });
});

describe("UX #9: word-level diff groups a rewritten phrase", () => {
  it("shows one removed phrase, then one added phrase", () => {
    expect(wordDiff("Sabin holds the note and has been patient so far.", "Sabin holds the note and wants it paid by midwinter.")).toEqual([
      { op: "same", text: "Sabin holds the note and " },
      { op: "del", text: "has been patient so far." },
      { op: "add", text: "wants it paid by midwinter." },
    ]);
  });
});
