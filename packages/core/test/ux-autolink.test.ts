// UX review #14: names of other pages link to them when a page is shown (rendering only).
import { describe, expect, it } from "vitest";
import { autolink, type LinkTarget } from "../src";

const T: LinkTarget[] = [
  { slug: "ysolt-marrow", name: "Ysolt Marrow", aliases: ["Ysolt"], href: "/e/ysolt-marrow" },
  { slug: "lamplighters-guild", name: "Lamplighters' Guild", aliases: ["the Guild"], href: "/e/lamplighters-guild" },
  { slug: "corwen-hale", name: "Corwen Hale", aliases: ["Cor"], href: "/e/corwen-hale" },
];

describe("UX #14: auto-links between pages", () => {
  it("links the first mention of each other page, longest name first", () => {
    expect(autolink("Ysolt Marrow and Ysolt again, then the Lamplighters' Guild.", T)).toBe(
      "[Ysolt Marrow](/e/ysolt-marrow) and Ysolt again, then the [Lamplighters' Guild](/e/lamplighters-guild).",
    );
  });
  it("skips the page itself, short aliases, partial words, code and existing links", () => {
    const md = "Corwen Hale met Cor. Ysolts are not Ysolt.\n\n```\nYsolt Marrow\n```\n`the Guild` and [the Guild](/x) then the Guild";
    expect(autolink(md, T, { self: "corwen-hale" })).toBe(
      "Corwen Hale met Cor. Ysolts are not [Ysolt](/e/ysolt-marrow).\n\n```\nYsolt Marrow\n```\n`the Guild` and [the Guild](/x) then [the Guild](/e/lamplighters-guild)",
    );
  });
  it("turns [[Name]] and [[Name|text]] into links, and unknown ones into plain text", () => {
    expect(autolink("See [[corwen-hale|the keeper]], [[Ysolt]] and [[Nobody]].", T)).toBe("See [the keeper](/e/corwen-hale), [Ysolt](/e/ysolt-marrow) and Nobody.");
  });
});
