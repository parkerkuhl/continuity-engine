/**
 * Markdown export and import of a whole campaign (SPEC "Page format and export layout"):
 *
 * ```
 * campaigns/<campaign-slug>/
 *   campaign.md        name, settings, boundaries, approval mode, as-of moment (front matter is what import reads)
 *   voice-anchor.md    the sample and profile as sections, the rest in front matter
 *   rulings.md         one `##` per ruling, oldest first
 *   pc.md              the PC sheet as front matter
 *   overlays/          the campaign layer of each page, in the world's folders (characters/, places/ ...):
 *                        a world page's file has `overlay: true` and only the campaign's sections;
 *                        a campaign-only page is a full entity page
 *   threads.md         one `##` per thread
 *   chapters/ch-01.md  the chapter summary (once closed) and one `## Scene N` per scene
 *   log/0001.md ...    one file per update, in the SPEC's update entry format
 *   gm/<kind>/<key>.md one file per GM note (spoiler-gated in the app)
 * ```
 *
 * Every reference to a page is its slug. Section knowers ("who knows this secret") go in the page file's
 * front matter: `knows` for the campaign's sections, `world_knows` for the world sections it learned.
 * A heading in a multi-section file (rulings, threads, chapters, voice anchor) carries its fields as a
 * YAML flow map in a comment: `## Find the heir  <!-- {state: open, tags: [ch-02]} -->`. A body line
 * that starts with `## ` is written as `\## ` there, so it can't split the file.
 *
 * A campaign export also holds its world (`worlds/<world-slug>/`), so one .zip restores both. Import
 * either creates that world too, or adds the campaign to an existing world given by id.
 */
import { Document, isMap, isSeq, parse, visit } from "yaml";
import { z } from "zod";
import {
  ApprovalMode,
  Author,
  CampaignSettings,
  GmNoteKind,
  Kebab,
  RulingOrigin,
  Severity,
  SeverityPolicy,
  ThreadState,
  UpdateStatus,
  UpdateType,
} from "../enums";
import { slugify } from "../slug";
import type { ConflictRef } from "../enums";
import type { Campaign, NewSection, Section, Storage, World, WriteMeta } from "../storage/types";
import { PageFormatError, parseEntityPage, parseSectionList, renderEntityPage, renderFrontMatter, renderSectionList, splitFrontMatter } from "./entity-page";
import { splitSections } from "./sections";
import { applyWorldImport, entityPath, exportWorld, LOAD_GUIDE, planWorldImport, type Files } from "./world";

export const CAMPAIGN_FILE = "campaign.md";

// ---------------- shared helpers ----------------

const FENCE = /^\s{0,3}(```|~~~)/;

/** `## ` at the start of a body line (outside code fences) would start a new section: add a backslash. */
function escapeBody(md: string): string {
  return mapOutsideFences(md, (line) => (/^\\*## /.test(line) ? `\\${line}` : line));
}
function unescapeBody(md: string): string {
  return mapOutsideFences(md, (line) => (/^\\+## /.test(line) ? line.slice(1) : line));
}
function mapOutsideFences(md: string, f: (line: string) => string): string {
  let inFence = false;
  return md
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) inFence = !inFence;
      return inFence || FENCE.test(line) ? line : f(line);
    })
    .join("\n");
}

function flowYaml(data: Record<string, unknown>): string {
  const doc = new Document(data);
  visit(doc, {
    Map: (_k, n) => void (isMap(n) && (n.flow = true)),
    Seq: (_k, n) => void (isSeq(n) && (n.flow = true)),
  });
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 }).trim();
}

function heading(title: string, attrs: Record<string, unknown>): string {
  const kept = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)));
  return Object.keys(kept).length ? `## ${title}  <!-- ${flowYaml(kept)} -->` : `## ${title}`;
}

const HEADING = /^(.*?)\s*(?:<!--([\s\S]*?)-->)?\s*$/;

function parseHeading(line: string, file: string): { title: string; attrs: unknown } {
  const [, title = "", raw] = HEADING.exec(line)!;
  if (!raw?.trim()) return { title, attrs: {} };
  try {
    return { title, attrs: parse(raw) ?? {} };
  } catch {
    throw new PageFormatError(file, `heading "${title}": its fields aren't readable YAML`);
  }
}

/** Front matter is optional in the campaign's multi-section files. */
function splitOptionalFrontMatter(md: string, file: string): { data: unknown; body: string } {
  return md.startsWith("---\n") || md.startsWith("---\r\n") ? splitFrontMatter(md, file) : { data: {}, body: md.replace(/\r\n/g, "\n") };
}

function check<T>(schema: z.ZodType<T>, data: unknown, file: string, what = "front matter"): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new PageFormatError(file, `${what}: ${r.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ")}`);
  return r.data;
}

function sections(body: string, file: string) {
  const { preamble, sections: raw } = splitSections(body);
  if (preamble) throw new PageFormatError(file, "text before the first ## heading");
  return raw.map((r) => ({ ...parseHeading(r.headingLine, file), body: unescapeBody(r.body) }));
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");
export const sceneLabel = (chapter: number, number: number) => `ch-${pad(chapter, 2)}-s${number}`;
const ensureNewline = (s: string) => `${s.replace(/\s+$/, "")}\n`;

// ---------------- file schemas ----------------

const CampaignFrontMatter = z.object({
  campaign: z.string(),
  name: z.string().min(1),
  world: z.string(),
  approval_mode: ApprovalMode,
  severity_policy: SeverityPolicy.optional(),
  as_of: z.string().optional(),
  current_chapter: z.number().int().min(1).default(1),
  spoilers_on: z.boolean().default(false),
  settings: CampaignSettings.default({}),
});

const Knows = z.record(Kebab, z.array(Kebab)).default({});

const OverlayFrontMatter = z.object({
  id: Kebab,
  overlay: z.literal(true),
  locked_sections: z.array(Kebab).default([]),
  knows: Knows,
  world_knows: Knows,
});

const VoiceFrontMatter = z.object({
  interior_level: z.string().default(""),
  avoid_list: z.array(z.string()).default([]),
  voice_rulings: z.array(z.string()).default([]),
  scenes_since_audit: z.number().int().min(0).default(0),
});

const RulingAttrs = z.object({ origin: RulingOrigin.default("in_play") });
const ThreadAttrs = z.object({
  state: ThreadState.default("open"),
  tags: z.array(Kebab).default([]),
  opened: z.number().int().optional(),
  resolved: z.number().int().optional(),
});
const ChapterFrontMatter = z.object({
  chapter: z.number().int().min(1),
  title: z.string().optional(),
  closed_at: z.string().nullable().optional(),
});
const SceneAttrs = z.object({ place: Kebab.optional(), present: z.array(Kebab).default([]), logged_at: z.string().optional() });

const LogFrontMatter = z.object({
  seq: z.number().int().min(1),
  entities: z.array(Kebab).default([]),
  tags: z.array(Kebab).default([]),
  type: UpdateType,
  severity: Severity,
  status: UpdateStatus,
  story_time: z.string().optional(),
  chapter: z.number().int().optional(),
  scene: z.string().optional(),
  supersedes: z.number().int().optional(),
  conflicts_with: z
    .union([z.object({ update: z.number().int() }), z.object({ section: z.string().regex(/^[a-z0-9-]+#[a-z0-9-]+$/, "must be page-slug#section-key"), layer: z.enum(["world", "campaign"]) })])
    .optional(),
  knows: z.array(Kebab).default([]),
  author: Author,
});

const GmFrontMatter = z.object({ kind: GmNoteKind, key: z.string().min(1), data: z.record(z.string(), z.unknown()).optional() });

// ---------------- export ----------------

/** Export a campaign, with its world unless `includeWorld` is false. */
export async function exportCampaign(storage: Storage, campaignId: string, opts: { includeWorld?: boolean } = {}): Promise<Files> {
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) throw new Error(`campaign ${campaignId} not found`);
  const world = (await storage.getWorld(campaign.worldId))!;
  const files: Files = opts.includeWorld === false ? new Map() : await exportWorld(storage, world.id);
  const root = `campaigns/${slugify(campaign.name) || "campaign"}`;
  const put = (path: string, content: string) => files.set(`${root}/${path}`, content);

  const entities = await storage.listEntities(world.id, { campaignId });
  const slugOf = new Map(entities.map((e) => [e.id, e.slug]));
  const slugs = (ids: string[]) => ids.map((id) => slugOf.get(id)).filter((s): s is string => !!s);
  const knowsOf = async (secs: Section[]) => {
    const out: Record<string, string[]> = {};
    for (const s of secs) {
      const holders = slugs(await storage.listKnowers("section", s.id)).sort();
      if (holders.length) out[s.key] = holders;
    }
    return out;
  };

  put(CAMPAIGN_FILE, renderCampaignFile(campaign, world));

  // overlays: the campaign layer of every page
  for (const e of entities) {
    const page = (await storage.getPage(e.id, { campaignId }))!;
    const own = page.sections.filter((s) => s.campaignId === campaignId).sort((a, b) => a.order - b.order);
    const knows = await knowsOf(own);
    if (e.campaignId === campaignId) {
      put(`overlays/${entityPath(e)}`, renderEntityPage(page, { campaignId, extra: Object.keys(knows).length ? { knows } : {} }));
      continue;
    }
    const worldKnows = await knowsOf((await storage.getPage(e.id))!.sections);
    if (!own.length && !Object.keys(worldKnows).length) continue;
    const fm = renderFrontMatter({
      id: e.slug,
      overlay: true,
      ...(own.some((s) => s.lockedByUser) ? { locked_sections: own.filter((s) => s.lockedByUser).map((s) => s.key) } : {}),
      ...(Object.keys(knows).length ? { knows } : {}),
      ...(Object.keys(worldKnows).length ? { world_knows: worldKnows } : {}),
    });
    const body = renderSectionList(null, own);
    put(`overlays/${entityPath(e)}`, `${fm}${body ? `${body}\n` : ""}`);
  }

  const anchor = await storage.getVoiceAnchor(campaignId);
  if (anchor) {
    put(
      "voice-anchor.md",
      renderFrontMatter({
        interior_level: anchor.interiorLevel,
        avoid_list: anchor.avoidList,
        voice_rulings: anchor.voiceRulings,
        scenes_since_audit: anchor.scenesSinceAudit,
      }) + `## Sample\n${escapeBody(anchor.sampleVerbatim)}`.trimEnd() + `\n\n` + `## Profile\n${escapeBody(anchor.profileMd)}`.trimEnd() + "\n",
    );
  }

  const rulings = (await storage.listRulings(world.id, campaignId)).filter((r) => r.campaignId === campaignId);
  if (rulings.length) {
    put("rulings.md", rulings.map((r, i) => `${heading(`Ruling ${i + 1}`, { origin: r.origin })}\n${escapeBody(r.text)}`.trimEnd()).join("\n\n") + "\n");
  }

  const sheet = await storage.getPcSheet(campaignId);
  if (sheet) put("pc.md", `${renderFrontMatter(sheet.data)}# PC sheet\n\nThe front matter above is the sheet.\n`);

  const threads = await storage.listThreads(campaignId);
  if (threads.length) {
    put(
      "threads.md",
      threads
        .map((t) => `${heading(t.title, { state: t.state, tags: t.tags, opened: t.openedChapter, resolved: t.resolvedChapter })}\n${escapeBody(t.bodyMd)}`.trimEnd())
        .join("\n\n") + "\n",
    );
  }

  const chapters = await storage.listChapters(campaignId);
  const scenes = await storage.listScenes(campaignId);
  const labelOf = new Map(scenes.map((s) => [s.id, sceneLabel(s.chapter, s.number)]));
  const numbers = [...new Set([...chapters.map((c) => c.number), ...scenes.map((s) => s.chapter)])].sort((a, b) => a - b);
  for (const n of numbers) {
    const row = chapters.find((c) => c.number === n);
    const parts: string[] = [];
    if (row) parts.push(`## Summary\n${escapeBody(row.summaryMd)}`.trimEnd());
    for (const s of scenes.filter((x) => x.chapter === n).sort((a, b) => a.number - b.number)) {
      const attrs = { place: s.placeEntityId ? slugOf.get(s.placeEntityId) : undefined, present: slugs(s.presentEntityIds), logged_at: s.loggedAt };
      parts.push(`${heading(`Scene ${s.number}`, attrs)}\n${escapeBody(s.summaryMd)}`.trimEnd());
    }
    const fm = renderFrontMatter({ chapter: n, ...(row ? { title: row.title, closed_at: row.closedAt } : {}) });
    put(`chapters/ch-${pad(n, 2)}.md`, `${fm}${parts.join("\n\n")}${parts.length ? "\n" : ""}`);
  }

  const updates = await storage.listUpdates(campaignId);
  const seqOf = new Map(updates.map((u) => [u.id, u.seq]));
  const width = Math.max(4, String(updates.at(-1)?.seq ?? 0).length);
  for (const u of updates) {
    const fm = renderFrontMatter({
      seq: u.seq,
      entities: slugs(u.entityIds),
      tags: u.tags,
      type: u.type,
      severity: u.severity,
      status: u.status,
      ...(u.storyTime ? { story_time: u.storyTime } : {}),
      ...(u.chapter !== null ? { chapter: u.chapter } : {}),
      ...(u.sceneId && labelOf.has(u.sceneId) ? { scene: labelOf.get(u.sceneId) } : {}),
      ...(u.supersedesId && seqOf.has(u.supersedesId) ? { supersedes: seqOf.get(u.supersedesId) } : {}),
      ...(await conflictFields(storage, u.conflictsWith, seqOf, slugOf)),
      knows: slugs(await storage.listKnowers("update", u.id)).sort(),
      author: u.author,
    });
    put(`log/${pad(u.seq, width)}.md`, `${fm}${ensureNewline(u.bodyMd)}`);
  }

  const usedGm = new Set<string>();
  for (const n of await storage.listGmNotes(campaignId)) {
    const base = `gm/${n.kind}/${slugify(n.key) || "note"}`;
    let path = `${base}.md`;
    for (let i = 2; usedGm.has(path); i++) path = `${base}-${i}.md`;
    usedGm.add(path);
    put(path, `${renderFrontMatter({ kind: n.kind, key: n.key, ...(n.data ? { data: n.data } : {}) })}${ensureNewline(n.bodyMd)}`);
  }

  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

async function conflictFields(storage: Storage, ref: ConflictRef | null, seqOf: Map<string, number>, slugOf: Map<string, string>) {
  if (!ref) return {};
  if (ref.type === "update") return seqOf.has(ref.id) ? { conflicts_with: { update: seqOf.get(ref.id)! } } : {};
  const section = await storage.getSection(ref.id);
  const slug = section && slugOf.get(section.entityId);
  return section && slug ? { conflicts_with: { section: `${slug}#${section.key}`, layer: section.campaignId ? "campaign" : "world" } } : {};
}

function renderCampaignFile(c: Campaign, world: World): string {
  const fm = renderFrontMatter({
    campaign: slugify(c.name),
    name: c.name,
    world: slugify(world.name),
    approval_mode: c.approvalMode,
    severity_policy: c.severityPolicy,
    ...(c.asOfStoryTime ? { as_of: c.asOfStoryTime } : {}),
    current_chapter: c.currentChapter,
    spoilers_on: c.spoilersOn,
    settings: c.settings,
  });
  const s = c.settings;
  const lines = [`# ${c.name}`, "", `Campaign in ${world.name}. Generated from the campaign; import reads the front matter above.`];
  if (c.asOfStoryTime) lines.push("", `As of: ${c.asOfStoryTime}`);
  const rows: [string, string | undefined][] = [
    ["Genre", s.genre],
    ["Tone", s.tone],
    ["Difficulty", s.difficulty],
    ["Length", s.length],
    ["Pacing", s.pacing],
    ["Dice", s.dice],
    ["Turn length", s.turn_length],
  ];
  const set = rows.filter(([, v]) => v);
  if (set.length) lines.push("", "## Settings", "", ...set.map(([k, v]) => `- ${k}: ${v}`));
  if (s.lines?.length || s.veils?.length) {
    lines.push("", "## Boundaries", "");
    if (s.lines?.length) lines.push(`- Lines: ${s.lines.join("; ")}`);
    if (s.veils?.length) lines.push(`- Veils: ${s.veils.join("; ")}`);
  }
  return `${fm}${lines.join("\n")}\n`;
}

// ---------------- import ----------------

interface CampaignPlan {
  root: string;
  campaign: z.infer<typeof CampaignFrontMatter>;
  pages: { path: string; page: ReturnType<typeof parseEntityPage>; knows: Record<string, string[]> }[];
  overlays: { path: string; id: string; sections: NewSection[]; knows: Record<string, string[]>; worldKnows: Record<string, string[]> }[];
  voice: (z.infer<typeof VoiceFrontMatter> & { sample: string; profile: string }) | null;
  rulings: { text: string; origin: z.infer<typeof RulingOrigin> }[];
  pc: Record<string, unknown> | null;
  threads: { title: string; body: string; attrs: z.infer<typeof ThreadAttrs> }[];
  chapters: { fm: z.infer<typeof ChapterFrontMatter>; summary: string | null; scenes: { label: string; summary: string; attrs: z.infer<typeof SceneAttrs> }[] }[];
  log: { path: string; fm: z.infer<typeof LogFrontMatter>; body: string }[];
  gm: { fm: z.infer<typeof GmFrontMatter>; body: string }[];
}

/** Find the one campaign in `files` and parse it. Nothing is checked against storage here. */
function planCampaign(files: Files): CampaignPlan {
  const found = [...files.keys()].filter((p) => p === CAMPAIGN_FILE || /^campaigns\/[^/]+\/campaign\.md$/.test(p));
  if (found.length !== 1) throw new Error(`expected exactly one campaigns/<slug>/${CAMPAIGN_FILE}, found ${found.length}`);
  const root = found[0]!.slice(0, -CAMPAIGN_FILE.length);
  const own = [...files].filter(([p]) => p.startsWith(root) && p.endsWith(".md")).sort(([a], [b]) => a.localeCompare(b));
  const plan: CampaignPlan = { root, campaign: null!, pages: [], overlays: [], voice: null, rulings: [], pc: null, threads: [], chapters: [], log: [], gm: [] };

  for (const [path, md] of own) {
    const rel = path.slice(root.length);
    if (rel === CAMPAIGN_FILE) {
      plan.campaign = check(CampaignFrontMatter, splitFrontMatter(md, path).data, path);
    } else if (rel.startsWith("overlays/")) {
      const { data, body } = splitFrontMatter(md, path);
      if ((data as { overlay?: unknown })?.overlay === true) {
        const fm = check(OverlayFrontMatter, data, path);
        const parsed = parseSectionList(body, path, fm.locked_sections);
        if (parsed.hasSummary) throw new PageFormatError(path, "an overlay holds campaign sections only; the summary belongs to the world page");
        plan.overlays.push({ path, id: fm.id, sections: parsed.sections, knows: fm.knows, worldKnows: fm.world_knows });
      } else {
        const page = parseEntityPage(md, path);
        const { knows } = check(z.object({ knows: Knows }), data, path);
        plan.pages.push({ path, page, knows });
      }
    } else if (rel === "voice-anchor.md") {
      const { data, body } = splitFrontMatter(md, path);
      const fm = check(VoiceFrontMatter, data, path);
      const secs = sections(body, path);
      const get = (t: string) => secs.find((s) => s.title === t)?.body ?? "";
      const extra = secs.find((s) => s.title !== "Sample" && s.title !== "Profile");
      if (extra) throw new PageFormatError(path, `unknown section "${extra.title}" (only Sample and Profile)`);
      plan.voice = { ...fm, sample: get("Sample"), profile: get("Profile") };
    } else if (rel === "rulings.md") {
      for (const s of sections(splitOptionalFrontMatter(md, path).body, path)) {
        plan.rulings.push({ text: s.body, origin: check(RulingAttrs, s.attrs, path, `"${s.title}"`).origin });
      }
    } else if (rel === "pc.md") {
      plan.pc = check(z.record(z.string(), z.unknown()), splitFrontMatter(md, path).data ?? {}, path);
    } else if (rel === "threads.md") {
      for (const s of sections(splitOptionalFrontMatter(md, path).body, path)) {
        if (!s.title) throw new PageFormatError(path, "a thread needs a title");
        plan.threads.push({ title: s.title, body: s.body, attrs: check(ThreadAttrs, s.attrs, path, `"${s.title}"`) });
      }
    } else if (/^chapters\/[^/]+\.md$/.test(rel)) {
      const { data, body } = splitFrontMatter(md, path);
      const fm = check(ChapterFrontMatter, data, path);
      let summary: string | null = null;
      const scenes: CampaignPlan["chapters"][number]["scenes"] = [];
      for (const s of sections(body, path)) {
        const m = /^Scene (\d+)$/.exec(s.title);
        if (s.title === "Summary") summary = s.body;
        else if (m) scenes.push({ label: sceneLabel(fm.chapter, Number(m[1])), summary: s.body, attrs: check(SceneAttrs, s.attrs, path, `"${s.title}"`) });
        else throw new PageFormatError(path, `unknown section "${s.title}" (expected Summary or Scene N)`);
      }
      if (summary !== null && fm.title === undefined) throw new PageFormatError(path, "a chapter summary needs a title in the front matter");
      plan.chapters.push({ fm, summary, scenes });
    } else if (/^log\/[^/]+\.md$/.test(rel)) {
      const { data, body } = splitFrontMatter(md, path);
      plan.log.push({ path, fm: check(LogFrontMatter, data, path), body: body.replace(/\s+$/, "") });
    } else if (/^gm\/.+\.md$/.test(rel)) {
      const { data, body } = splitFrontMatter(md, path);
      plan.gm.push({ fm: check(GmFrontMatter, data, path), body: body.replace(/\s+$/, "") });
    } else {
      throw new PageFormatError(path, "not part of the campaign layout");
    }
  }
  if (!plan.campaign) throw new Error(`${root}${CAMPAIGN_FILE} is missing`);
  return plan;
}

/** World page slugs with their world section keys, from a world plan or from storage. */
type WorldIndex = Map<string, Set<string>>;

/** `taken`: slugs already used in the target world by other campaigns' own pages (slugs are unique per world). */
function validate(plan: CampaignPlan, world: WorldIndex, taken: Set<string>): void {
  const known = new Set(world.keys());
  const pageKeys = new Map<string, Set<string>>();
  for (const { path, page } of plan.pages) {
    if (known.has(page.slug!)) throw new PageFormatError(path, `id "${page.slug}" is also a world page`);
    if (taken.has(page.slug!)) throw new PageFormatError(path, `id "${page.slug}" is already a page in this world (another campaign's)`);
    if (pageKeys.has(page.slug!)) throw new PageFormatError(path, `id "${page.slug}" is used by two campaign pages`);
    known.add(page.slug!);
    pageKeys.set(page.slug!, new Set((page.sections ?? []).map((s) => s.key ?? slugify(s.heading))));
  }
  const need = (slug: string | undefined, file: string, what: string) => {
    if (slug && !known.has(slug)) throw new PageFormatError(file, `${what} "${slug}" is not a page in this world or campaign`);
  };
  const needAll = (slugs: string[], file: string, what: string) => slugs.forEach((s) => need(s, file, what));
  const needKeys = (knows: Record<string, string[]>, keys: Set<string>, file: string, layer: string) => {
    for (const [key, holders] of Object.entries(knows)) {
      if (!keys.has(key)) throw new PageFormatError(file, `${layer} names unknown section "${key}"`);
      needAll(holders, file, "knower");
    }
  };

  for (const { path, page, knows } of plan.pages) needKeys(knows, pageKeys.get(page.slug!)!, path, "knows");
  const overlaid = new Map<string, string>();
  for (const o of plan.overlays) {
    if (!world.has(o.id)) throw new PageFormatError(o.path, `overlay of "${o.id}", which is not a world page`);
    const prior = overlaid.get(o.id);
    if (prior) throw new PageFormatError(o.path, `"${o.id}" is also overlaid by ${prior}`);
    overlaid.set(o.id, o.path);
    needKeys(o.knows, new Set(o.sections.map((s) => s.key!)), o.path, "knows");
    needKeys(o.worldKnows, world.get(o.id)!, o.path, "world_knows");
  }

  const root = plan.root;
  const labels = new Set<string>();
  const chapterNumbers = new Set<number>();
  for (const c of plan.chapters) {
    const file = `${root}chapters/ch-${pad(c.fm.chapter, 2)}.md`;
    if (chapterNumbers.has(c.fm.chapter)) throw new PageFormatError(file, `chapter ${c.fm.chapter} appears twice`);
    chapterNumbers.add(c.fm.chapter);
    for (const s of c.scenes) {
      if (labels.has(s.label)) throw new PageFormatError(file, `scene ${s.label} appears twice`);
      labels.add(s.label);
      need(s.attrs.place, file, "place");
      needAll(s.attrs.present, file, "present");
    }
  }

  const seqs = new Set<number>();
  for (const { path, fm } of plan.log) {
    if (seqs.has(fm.seq)) throw new PageFormatError(path, `seq ${fm.seq} appears twice`);
    seqs.add(fm.seq);
  }
  for (const { path, fm } of plan.log) {
    needAll(fm.entities, path, "entity");
    needAll(fm.knows, path, "knower");
    if (fm.scene && !labels.has(fm.scene)) throw new PageFormatError(path, `scene ${fm.scene} is not in chapters/`);
    if (fm.supersedes !== undefined && !seqs.has(fm.supersedes)) throw new PageFormatError(path, `supersedes ${fm.supersedes}, which is not in log/`);
    const c = fm.conflicts_with;
    if (c && "update" in c && !seqs.has(c.update)) throw new PageFormatError(path, `conflicts with update ${c.update}, which is not in log/`);
    if (c && "section" in c) {
      const [slug, key] = c.section.split("#") as [string, string];
      const keys =
        c.layer === "world"
          ? world.get(slug)
          : (pageKeys.get(slug) ?? new Set(plan.overlays.find((o) => o.id === slug)?.sections.map((s) => s.key!) ?? []));
      if (!keys?.has(key)) throw new PageFormatError(path, `conflicts with section ${c.section} (${c.layer}), which doesn't exist`);
    }
  }
}

/**
 * Import one exported campaign. With `worldId`, the campaign joins that existing world (any world
 * folder in `files` is ignored); without it, the world folder in `files` is imported as a new world first.
 * Every file is parsed and checked (page references, scenes, seqs) before anything is written.
 */
export async function importCampaign(
  storage: Storage,
  files: Files,
  opts: { ownerId: string; meta: WriteMeta; worldId?: string },
): Promise<{ world: World; campaign: Campaign }> {
  const plan = planCampaign(files);
  const worldFiles: Files = new Map([...files].filter(([p]) => !p.startsWith(plan.root)));

  let index: WorldIndex;
  const taken = new Set<string>();
  let worldPlan: ReturnType<typeof planWorldImport> | null = null;
  let existing: World | null = null;
  if (opts.worldId) {
    existing = await storage.getWorld(opts.worldId);
    if (!existing) throw new Error(`world ${opts.worldId} not found`);
    index = new Map();
    for (const e of await storage.listEntities(existing.id)) {
      const page = (await storage.getPage(e.id))!;
      index.set(e.slug, new Set(page.sections.map((s) => s.key)));
    }
    for (const c of await storage.listCampaigns(existing.id)) {
      for (const e of await storage.listEntities(existing.id, { campaignId: c.id })) if (e.campaignId === c.id) taken.add(e.slug);
    }
  } else {
    if (![...worldFiles.keys()].some((p) => p === LOAD_GUIDE || p.endsWith(`/${LOAD_GUIDE}`))) {
      throw new Error(`this export has no world folder (worlds/<slug>/${LOAD_GUIDE}); import it into an existing world instead`);
    }
    worldPlan = planWorldImport(worldFiles);
    index = new Map(worldPlan.pages.map(({ page }) => [page.slug!, new Set((page.sections ?? []).map((s) => s.key ?? slugify(s.heading)))]));
  }
  validate(plan, index, taken);

  // ---- writes ----
  const meta = opts.meta;
  const world = existing ?? (await applyWorldImport(storage, worldPlan!, { ownerId: opts.ownerId, meta }));
  const cfm = plan.campaign;
  let campaign = await storage.createCampaign(
    {
      worldId: world.id,
      ownerId: world.ownerId,
      name: cfm.name,
      settings: cfm.settings,
      approvalMode: cfm.approval_mode,
      ...(cfm.severity_policy && { severityPolicy: cfm.severity_policy }),
      asOfStoryTime: cfm.as_of ?? null,
    },
    meta,
  );
  if (campaign.currentChapter !== cfm.current_chapter || campaign.spoilersOn !== cfm.spoilers_on) {
    campaign = await storage.updateCampaign(campaign.id, { currentChapter: cfm.current_chapter, spoilersOn: cfm.spoilers_on }, meta);
  }
  const cid = campaign.id;

  const idOf = new Map<string, string>();
  for (const e of await storage.listEntities(world.id)) idOf.set(e.slug, e.id);
  for (const { page } of plan.pages) {
    const created = await storage.createEntity({ ...page, worldId: world.id, campaignId: cid }, meta);
    idOf.set(created.slug, created.id);
  }
  const ids = (slugs: string[]) => slugs.map((s) => idOf.get(s)!);

  for (const o of plan.overlays) {
    for (const s of o.sections) await storage.addSection(idOf.get(o.id)!, { ...s, campaignId: cid }, meta);
  }
  const sectionId = async (slug: string, key: string, layer: "world" | "campaign") => {
    const page = (await storage.getPage(idOf.get(slug)!, layer === "campaign" ? { campaignId: cid } : {}))!;
    return page.sections.find((s) => s.key === key && s.campaignId === (layer === "campaign" ? cid : null))!.id;
  };
  const addKnowers = async (slug: string, knows: Record<string, string[]>, layer: "world" | "campaign") => {
    for (const [key, holders] of Object.entries(knows)) {
      if (holders.length) await storage.addSectionKnowers(await sectionId(slug, key, layer), ids(holders), meta);
    }
  };
  for (const { page, knows } of plan.pages) await addKnowers(page.slug!, knows, "campaign");
  for (const o of plan.overlays) {
    await addKnowers(o.id, o.knows, "campaign");
    await addKnowers(o.id, o.worldKnows, "world");
  }

  for (const r of plan.rulings) await storage.createRuling({ worldId: world.id, campaignId: cid, text: r.text, origin: r.origin }, meta);
  if (plan.voice) {
    const v = plan.voice;
    await storage.setVoiceAnchor(
      { campaignId: cid, sampleVerbatim: v.sample, profileMd: v.profile, interiorLevel: v.interior_level, avoidList: v.avoid_list, voiceRulings: v.voice_rulings, scenesSinceAudit: v.scenes_since_audit },
      meta,
    );
  }
  if (plan.pc) await storage.setPcSheet({ campaignId: cid, data: plan.pc }, meta);

  const sceneIds = new Map<string, string>();
  for (const c of [...plan.chapters].sort((a, b) => a.fm.chapter - b.fm.chapter)) {
    if (c.fm.title !== undefined) {
      await storage.createChapter({ campaignId: cid, number: c.fm.chapter, title: c.fm.title, summaryMd: c.summary ?? "", closedAt: c.fm.closed_at ?? null }, meta);
    }
    for (const s of c.scenes) {
      const scene = await storage.createScene(
        { campaignId: cid, chapter: c.fm.chapter, placeEntityId: s.attrs.place ? idOf.get(s.attrs.place)! : null, presentEntityIds: ids(s.attrs.present) },
        meta,
      );
      if (s.summary || s.attrs.logged_at) await storage.updateScene(scene.id, { summaryMd: s.summary, loggedAt: s.attrs.logged_at ?? null }, meta);
      sceneIds.set(s.label, scene.id);
    }
  }

  for (const t of plan.threads) {
    const thread = await storage.createThread({ campaignId: cid, title: t.title, bodyMd: t.body, tags: t.attrs.tags, openedChapter: t.attrs.opened ?? null }, meta);
    if (t.attrs.state !== "open" || t.attrs.resolved !== undefined) {
      await storage.updateThread(thread.id, { state: t.attrs.state, resolvedChapter: t.attrs.resolved ?? null }, meta);
    }
  }

  const updateIds = new Map<number, string>();
  const later: { id: string; ref: number }[] = [];
  for (const { fm, body } of [...plan.log].sort((a, b) => a.fm.seq - b.fm.seq)) {
    const c = fm.conflicts_with;
    let conflictsWith: ConflictRef | null = null;
    if (c && "section" in c) {
      const [slug, key] = c.section.split("#") as [string, string];
      conflictsWith = { type: "section", id: await sectionId(slug, key, c.layer) };
    } else if (c && updateIds.has(c.update)) conflictsWith = { type: "update", id: updateIds.get(c.update)! };
    const u = await storage.createUpdate(
      {
        campaignId: cid,
        entityIds: ids(fm.entities),
        tags: fm.tags,
        type: fm.type,
        severity: fm.severity,
        status: fm.status,
        storyTime: fm.story_time ?? null,
        chapter: fm.chapter ?? null,
        sceneId: fm.scene ? sceneIds.get(fm.scene)! : null,
        bodyMd: body,
        supersedesId: fm.supersedes !== undefined ? (updateIds.get(fm.supersedes) ?? null) : null,
        conflictsWith,
        knows: ids(fm.knows),
      },
      { ...meta, author: fm.author },
    );
    updateIds.set(fm.seq, u.id);
    if (c && "update" in c && !conflictsWith) later.push({ id: u.id, ref: c.update });
  }
  for (const l of later) await storage.updateUpdate(l.id, { conflictsWith: { type: "update", id: updateIds.get(l.ref)! } }, meta);

  for (const { fm, body } of plan.gm) await storage.createGmNote({ campaignId: cid, kind: fm.kind, key: fm.key, bodyMd: body, data: fm.data ?? null }, meta);

  return { world, campaign: (await storage.getCampaign(cid))! };
}

/** True when `files` hold a campaign export (so an upload can be routed to the right import). */
export function isCampaignExport(files: Files): boolean {
  return [...files.keys()].some((p) => p === CAMPAIGN_FILE || /^campaigns\/[^/]+\/campaign\.md$/.test(p));
}
