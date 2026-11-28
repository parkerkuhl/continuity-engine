/**
 * Entity page format (SPEC "Page format and export layout"): YAML front matter for structured fields,
 * then `## Summary` for the entity summary, then one `##` per section in order. A section heading may
 * carry an HTML comment with attributes: `## Hiding  <!-- visibility: secret -->`. `key: …` is added
 * only when the section key differs from the slugified heading.
 */
import { Document, isSeq, parse, visit } from "yaml";
import { z } from "zod";
import { EntityType, Kebab, Source, Visibility } from "../enums";
import { slugify } from "../slug";
import type { EntityPage, NewEntity, NewSection, Section } from "../storage/types";
import { splitSections } from "./sections";

export const PageFrontMatter = z.object({
  id: Kebab,
  type: EntityType,
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  source: Source,
  /** Only written for a page still waiting for approval. */
  status: z.literal("proposed").optional(),
  locked_sections: z.array(Kebab).default([]),
});

const HEADING = /^(.*?)\s*(?:<!--(.*?)-->)?\s*$/;

export function renderFrontMatter(data: Record<string, unknown>): string {
  const doc = new Document(data);
  visit(doc, { Seq: (_key, node) => void (isSeq(node) && (node.flow = true)) });
  return `---\n${doc.toString({ flowCollectionPadding: false, lineWidth: 0 }).trimEnd()}\n---\n`;
}

export function splitFrontMatter(md: string, file: string): { data: unknown; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md.replace(/\r\n/g, "\n"));
  if (!m) throw new PageFormatError(file, "missing front matter");
  return { data: parse(m[1]!), body: m[2]! };
}

export class PageFormatError extends Error {
  constructor(
    public readonly file: string,
    detail: string,
  ) {
    super(`${file}: ${detail}`);
    this.name = "PageFormatError";
  }
}

/**
 * Render one layer of a page: world canon by default (campaign overlay sections are not part of a
 * world page), or a campaign's own sections when `campaignId` is given. `extra` adds front matter fields.
 */
export function renderEntityPage(page: EntityPage, opts: { campaignId?: string | null; extra?: Record<string, unknown> } = {}): string {
  const layer = opts.campaignId ?? null;
  const sections = page.sections.filter((s) => s.campaignId === layer).sort((a, b) => a.order - b.order);
  const fm = renderFrontMatter({
    id: page.slug,
    type: page.type,
    name: page.name,
    aliases: page.aliases,
    source: page.source,
    ...(page.status === "proposed" ? { status: "proposed" } : {}),
    ...(sections.some((s) => s.lockedByUser)
      ? { locked_sections: sections.filter((s) => s.lockedByUser).map((s) => s.key) }
      : {}),
    ...opts.extra,
  });
  return `${fm}${renderSectionList(page.summary, sections)}\n`;
}

/** `## Summary` (when `summary` is not null) and then each section with its heading attributes. */
export function renderSectionList(summary: string | null, sections: Pick<Section, "heading" | "key" | "visibility" | "bodyMd">[]): string {
  const parts = summary === null ? [] : [`## Summary\n${summary}`.trimEnd()];
  for (const s of sections) {
    const attrs: string[] = [];
    if (s.visibility !== "public") attrs.push(`visibility: ${s.visibility}`);
    if (s.key !== slugify(s.heading)) attrs.push(`key: ${s.key}`);
    const head = attrs.length ? `## ${s.heading}  <!-- ${attrs.join("; ")} -->` : `## ${s.heading}`;
    parts.push(`${head}\n${s.bodyMd}`.trimEnd());
  }
  return parts.join("\n\n");
}

/** Parse a page into the input for `Storage.createEntity` (minus `worldId`). */
export function parseEntityPage(md: string, file: string): Omit<NewEntity, "worldId"> {
  const { data, body } = splitFrontMatter(md, file);
  const fmResult = PageFrontMatter.safeParse(data);
  if (!fmResult.success) {
    throw new PageFormatError(file, fmResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const fm = fmResult.data;
  const { summary, sections } = parseSectionList(body, file, fm.locked_sections);
  return { slug: fm.id, type: fm.type, name: fm.name, aliases: fm.aliases, source: fm.source, ...(fm.status && { status: fm.status }), summary, sections };
}

/** The inverse of `renderSectionList`. `summary` is "" when there is no `## Summary`. */
export function parseSectionList(body: string, file: string, lockedSections: string[] = []): { summary: string; hasSummary: boolean; sections: NewSection[] } {
  const { preamble, sections: raw } = splitSections(body);
  if (preamble) throw new PageFormatError(file, "text before the first ## heading");

  let summary = "";
  let hasSummary = false;
  const sections: NewSection[] = [];
  for (const r of raw) {
    const [, heading = "", attrText] = HEADING.exec(r.headingLine)!;
    const attrs = parseAttrs(attrText ?? "", file);
    if (slugify(heading) === "summary" && !attrs.key) {
      summary = r.body;
      hasSummary = true;
      continue;
    }
    const key = attrs.key ?? slugify(heading);
    const vis = Visibility.safeParse(attrs.visibility ?? "public");
    if (!vis.success) throw new PageFormatError(file, `section "${heading}": bad visibility "${attrs.visibility}"`);
    if (sections.some((s) => s.key === key)) throw new PageFormatError(file, `two sections have the key "${key}"`);
    sections.push({ key, heading, bodyMd: r.body, visibility: vis.data, lockedByUser: lockedSections.includes(key) });
  }
  const keys = new Set(sections.map((s) => s.key));
  const missing = lockedSections.filter((k) => !keys.has(k));
  if (missing.length) throw new PageFormatError(file, `locked_sections names unknown sections: ${missing.join(", ")}`);
  return { summary, hasSummary, sections };
}

function parseAttrs(text: string, file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(/[;,]/)) {
    if (!part.trim()) continue;
    const m = /^\s*([a-z_]+)\s*:\s*(.*?)\s*$/.exec(part);
    if (!m) throw new PageFormatError(file, `bad heading attribute "${part.trim()}"`);
    out[m[1]!] = m[2]!;
  }
  return out;
}
