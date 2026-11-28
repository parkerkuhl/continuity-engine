/**
 * Markdown export and import of a whole world (SPEC "Page format and export layout").
 * Built only on the `Storage` interface, so it works with any backend.
 *
 * Files are a `Map<path, content>` with paths relative to the export root, e.g.
 * `worlds/<world-slug>/characters/rickard-snow.md`. Use `writeFiles` / `readFiles` for disk.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { z } from "zod";
import { ApprovalMode, Depth, type EntityType } from "../enums";
import { slugify } from "../slug";
import type { Entity, EntityPage, NewEntity, Storage, World, WriteMeta } from "../storage/types";
import { PageFormatError, parseEntityPage, renderEntityPage, renderFrontMatter, splitFrontMatter } from "./entity-page";

export type Files = Map<string, string>;

export const LOAD_GUIDE = "00-load-guide.md";

const FOLDER: Record<EntityType, string> = {
  character: "characters",
  place: "places",
  faction: "factions",
  item: "items",
  concept: "setting",
  rule: "setting",
  event: "events",
};
const ROOT_PAGES = new Set(["glossary", "timeline"]);

const GUIDE_ORDER: { folder: string; title: string; when: string }[] = [
  { folder: "setting", title: "Setting", when: "Load for world rules, history and tone." },
  { folder: "places", title: "Places", when: "Load when a scene is set there." },
  { folder: "factions", title: "Factions", when: "Load when the faction or its members act." },
  { folder: "characters", title: "Characters", when: "Load when the character is present or discussed." },
  { folder: "items", title: "Items", when: "Load when the item is used or sought." },
  { folder: "events", title: "Events", when: "Load when the event is recalled or its effects matter." },
  { folder: "", title: "Reference", when: "Load for slang, forms of address and dates." },
];

const WorldFrontMatter = z.object({
  world: z.string().min(1),
  name: z.string().min(1),
  pitch: z.string().default(""),
  depth: Depth,
  default_approval_mode: ApprovalMode,
  as_of: z.string().optional(),
});

export function entityPath(e: Pick<Entity, "type" | "slug">): string {
  if (e.type === "concept" && ROOT_PAGES.has(e.slug)) return `${e.slug}.md`;
  return `${FOLDER[e.type]}/${e.slug}.md`;
}

export function renderLoadGuide(world: World, pages: Entity[]): string {
  const fm = renderFrontMatter({
    world: slugify(world.name),
    name: world.name,
    pitch: world.pitch,
    depth: world.depth,
    default_approval_mode: world.defaultApprovalMode,
    ...(world.asOfStoryTime ? { as_of: world.asOfStoryTime } : {}),
  });
  const lines = [
    `# Load guide: ${world.name}`,
    "",
    "Generated from the wiki; do not edit. Lists every page in this world and when to load it.",
    ...(world.asOfStoryTime ? ["", `As of: ${world.asOfStoryTime}`] : []),
  ];
  for (const g of GUIDE_ORDER) {
    const group = pages
      .filter((e) => dirname(entityPath(e)) === (g.folder || "."))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    if (!group.length) continue;
    lines.push("", `## ${g.title}`, g.when, "");
    for (const e of group) {
      const summary = e.summary.split("\n")[0]?.trim();
      const flag = e.status === "proposed" ? " (proposed, not yet approved)" : "";
      lines.push(`- [${e.name}](${entityPath(e)})${flag}${summary ? `: ${summary}` : ""}`);
    }
  }
  return `${fm}${lines.join("\n")}\n`;
}

/** Export a world's canon (entities with no campaign) as Markdown files. */
export async function exportWorld(storage: Storage, worldId: string): Promise<Files> {
  const world = await storage.getWorld(worldId);
  if (!world) throw new Error(`world ${worldId} not found`);
  const root = `worlds/${slugify(world.name)}`;
  const entities = await storage.listEntities(worldId);
  const files: Files = new Map();
  files.set(`${root}/${LOAD_GUIDE}`, renderLoadGuide(world, entities));
  for (const e of entities) {
    const page = (await storage.getPage(e.id)) as EntityPage;
    files.set(`${root}/${entityPath(e)}`, renderEntityPage(page));
  }
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

export interface WorldImportPlan {
  root: string;
  world: z.infer<typeof WorldFrontMatter>;
  pages: { path: string; page: Omit<NewEntity, "worldId"> }[];
}

/** Find, parse and validate one exported world in `files` without writing anything. */
export function planWorldImport(files: Files): WorldImportPlan {
  const guides = [...files.keys()].filter((p) => p.endsWith(`/${LOAD_GUIDE}`) || p === LOAD_GUIDE);
  if (guides.length !== 1) throw new Error(`expected exactly one ${LOAD_GUIDE}, found ${guides.length}`);
  const guidePath = guides[0]!;
  const root = guidePath.slice(0, -LOAD_GUIDE.length);

  const fmResult = WorldFrontMatter.safeParse(splitFrontMatter(files.get(guidePath)!, guidePath).data);
  if (!fmResult.success) throw new PageFormatError(guidePath, fmResult.error.issues.map((i) => i.message).join("; "));

  const pages = [...files]
    .filter(([p]) => p.startsWith(root) && p.endsWith(".md") && p !== guidePath)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, md]) => ({ path: p, page: parseEntityPage(md, p) }));
  const seen = new Map<string, string>();
  for (const { path, page } of pages) {
    const prior = seen.get(page.slug!);
    if (prior) throw new PageFormatError(path, `id "${page.slug}" is also used by ${prior}`);
    seen.set(page.slug!, path);
  }
  return { root, world: fmResult.data, pages };
}

/** Write a validated world import as a new world owned by `ownerId`. */
export async function applyWorldImport(storage: Storage, plan: WorldImportPlan, opts: { ownerId: string; meta: WriteMeta }): Promise<World> {
  const wfm = plan.world;
  const world = await storage.createWorld(
    { ownerId: opts.ownerId, name: wfm.name, pitch: wfm.pitch, depth: wfm.depth, defaultApprovalMode: wfm.default_approval_mode, asOfStoryTime: wfm.as_of ?? null },
    opts.meta,
  );
  for (const { page } of plan.pages) await storage.createEntity({ ...page, worldId: world.id }, opts.meta);
  return world;
}

/**
 * Import one exported world as a new world owned by `ownerId`. Every file is parsed and validated
 * before anything is written, so a malformed export writes nothing.
 */
export async function importWorld(
  storage: Storage,
  files: Files,
  opts: { ownerId: string; meta: WriteMeta },
): Promise<World> {
  return applyWorldImport(storage, planWorldImport(files), opts);
}

export async function writeFiles(dir: string, files: Files): Promise<void> {
  for (const [p, content] of files) {
    const full = join(dir, p);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
}

export async function readFiles(dir: string): Promise<Files> {
  const files: Files = new Map();
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const full = join(entry.parentPath, entry.name);
    files.set(relative(dir, full).split(sep).join("/"), await readFile(full, "utf8"));
  }
  return files;
}
