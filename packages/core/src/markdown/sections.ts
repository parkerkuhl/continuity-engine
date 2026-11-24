/** Helpers for the `##`-delimited section format of entity pages. Code fences are respected. */

const FENCE = /^\s{0,3}(```|~~~)/;
const H2 = /^## /;

export function hasLevel2Heading(md: string): boolean {
  let inFence = false;
  for (const line of md.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence && H2.test(line)) return true;
  }
  return false;
}

export interface RawSection {
  headingLine: string;
  body: string;
}

/** Split a page body into level-2 sections. Text before the first `##` is returned as `preamble`. */
export function splitSections(md: string): { preamble: string; sections: RawSection[] } {
  const sections: RawSection[] = [];
  const pre: string[] = [];
  let cur: { headingLine: string; lines: string[] } | null = null;
  let inFence = false;
  for (const line of md.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence && H2.test(line)) {
      if (cur) sections.push({ headingLine: cur.headingLine, body: trimBlank(cur.lines) });
      cur = { headingLine: line.slice(3), lines: [] };
    } else if (cur) cur.lines.push(line);
    else pre.push(line);
  }
  if (cur) sections.push({ headingLine: cur.headingLine, body: trimBlank(cur.lines) });
  return { preamble: trimBlank(pre), sections };
}

function trimBlank(lines: string[]): string {
  return lines.join("\n").replace(/^\s*\n/, "").replace(/\s+$/, "");
}
