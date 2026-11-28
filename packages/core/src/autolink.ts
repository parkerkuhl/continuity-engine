/**
 * Links between pages when Markdown is shown (UX review #14). Rendering only: stored Markdown never changes.
 *
 * - `[[Name]]` and `[[Name|text]]` link to the page with that name, alias or slug (plain text if there is none).
 * - The first plain mention of another page's exact name or alias (3+ characters, whole words) in a block of text
 *   becomes a link. Nothing inside code (fences or inline) or inside an existing link changes.
 */
export interface LinkTarget {
  href: string;
  name: string;
  aliases: string[];
  slug: string;
}

const FENCE = /^\s{0,3}(```|~~~)/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mdText = (s: string) => s.replace(/([\\[\]])/g, "\\$1");

export function autolink(md: string, targets: LinkTarget[], opts: { self?: string } = {}): string {
  const byKey = new Map<string, LinkTarget>();
  for (const t of targets) for (const k of [t.name, t.slug, ...t.aliases]) if (k && !byKey.has(k.toLowerCase())) byKey.set(k.toLowerCase(), t);
  const others = targets.filter((t) => t.slug !== opts.self);
  const names: [string, LinkTarget][] = [];
  for (const t of others) for (const n of [t.name, ...t.aliases]) if (n.trim().length >= 3) names.push([n, t]);
  names.sort((a, b) => b[0].length - a[0].length);
  const lookup = new Map(names.map(([n, t]) => [n, t]));
  const mention = names.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(([n]) => escapeRe(n)).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  const linked = new Set<string>();

  const linkPlain = (text: string): string => {
    // [[Name]] / [[Name|text]] first; unknown targets become their text.
    text = text.replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_m, ref: string, label?: string) => {
      const t = byKey.get(ref.trim().toLowerCase());
      const shown = (label ?? ref).trim();
      if (!t) return shown;
      linked.add(t.slug);
      return `[${mdText(shown)}](${t.href})`;
    });
    if (!mention) return text;
    // Leave links made above (or written by hand) alone: split them out and link the rest.
    return text
      .split(/(\[[^\]]*\]\([^)]*\))/g)
      .map((part, i) =>
        i % 2 === 1
          ? part
          : part.replace(mention, (m: string) => {
              const t = lookup.get(m)!;
              if (linked.has(t.slug)) return m;
              linked.add(t.slug);
              return `[${mdText(m)}](${t.href})`;
            }),
      )
      .join("");
  };

  let inFence = false;
  return md
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || /^( {4}|\t)/.test(line)) return line;
      // inline code spans stay as they are
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, i) => (i % 2 === 1 ? part : linkPlain(part)))
        .join("");
    })
    .join("\n");
}
