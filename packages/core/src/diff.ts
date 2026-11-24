/** Word-level diff for the web app's history and review screens (UX review #9). No library: a plain LCS. */

export type DiffPart = { op: "same" | "del" | "add"; text: string };

/** Splits text into words and the whitespace between them, so joining the parts gives the text back. */
const tokens = (s: string) => s.split(/(\s+)/).filter((t) => t !== "");

/** The longest-common-subsequence table is O(n·m); past this many cells, fall back to "all deleted, all added". */
const MAX_CELLS = 400_000;

export function wordDiff(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ op: "same", text: before }] : [];
  const a = tokens(before);
  const b = tokens(after);
  // Trim the common head and tail first: most edits change a few words in the middle.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const x = a.slice(head, a.length - tail);
  const y = b.slice(head, b.length - tail);
  const out: DiffPart[] = [];
  const push = (op: DiffPart["op"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };
  if (head) push("same", a.slice(0, head).join(""));
  if ((x.length + 1) * (y.length + 1) > MAX_CELLS) {
    if (x.length) push("del", x.join(""));
    if (y.length) push("add", y.join(""));
  } else {
    // lcs[i][j] = length of the LCS of x[i..] and y[j..]
    const w = y.length + 1;
    const lcs = new Uint32Array((x.length + 1) * w);
    for (let i = x.length - 1; i >= 0; i--)
      for (let j = y.length - 1; j >= 0; j--)
        lcs[i * w + j] = x[i] === y[j] ? lcs[(i + 1) * w + j + 1]! + 1 : Math.max(lcs[(i + 1) * w + j]!, lcs[i * w + j + 1]!);
    let i = 0;
    let j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) push("same", x[i++]!), j++;
      // Deletions before additions, so "60 → 80" reads old then new.
      else if (i < x.length && (j === y.length || lcs[(i + 1) * w + j]! >= lcs[i * w + j + 1]!)) push("del", x[i++]!);
      else push("add", y[j++]!);
    }
  }
  if (tail) push("same", a.slice(a.length - tail).join(""));
  return group(out);
}

/**
 * Word-by-word alternation ("has" → "wants", "been" → "it", …) is hard to read. A run of changes joined only by
 * spaces becomes one removed phrase followed by one added phrase.
 */
function group(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  let i = 0;
  while (i < parts.length) {
    if (parts[i]!.op === "same") {
      out.push(parts[i++]!);
      continue;
    }
    let del = "";
    let add = "";
    while (i < parts.length) {
      const p = parts[i]!;
      if (p.op === "del") del += p.text;
      else if (p.op === "add") add += p.text;
      else if (/^\s+$/.test(p.text) && i + 1 < parts.length && parts[i + 1]!.op !== "same") {
        del += p.text;
        add += p.text;
      } else break;
      i++;
    }
    if (del) out.push({ op: "del", text: del });
    if (add) out.push({ op: "add", text: add });
  }
  return out;
}
