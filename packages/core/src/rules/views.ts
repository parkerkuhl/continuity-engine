/**
 * Read models for the web app (SPEC "Web app screens" and "Spoiler model").
 * Everything here reads through the Storage interface; writes stay on RulesEngine.
 *
 * Player view (spoilers off) shows public sections, plus the secret sections and the updates
 * the PC knows (knowledge rows with the PC as holder), and no GM notes. GM view shows everything.
 */
import type { Campaign, Chapter, Entity, GmNote, PcSheet, Ruling, Scene, Section, Thread, Update, Version, VoiceAnchor, World } from "../storage/types";
import { slugify } from "../slug";
import { TO_PC_HEADING, TO_PC_KEY, findToPcSection, isToPcKey, type RulesEngine } from "./engine";

export interface Scope {
  world: World;
  campaign: Campaign | null;
  /** Spoilers on means GM view. A campaign keeps its own toggle; world-only screens pass it in. */
  spoilers: boolean;
  /** The PC's page, for the player view's "what the PC knows". */
  pc: Entity | null;
}

export interface UpdateView {
  update: Update;
  entities: Pick<Entity, "id" | "slug" | "name">[];
  knows: Pick<Entity, "id" | "slug" | "name">[];
  /** What a parked update clashes with, in words. */
  conflict: string | null;
  /** The same, split for a side-by-side view: what it clashes with, and that text. */
  conflictWith: { label: string; body: string } | null;
  /** Each tag's type: "time" for ch-NN, else the tagged entity's type ("other" if it no longer resolves). */
  tagTypes: { tag: string; type: Entity["type"] | "time" | "other" }[];
}

/**
 * The standard outline of a page, by type. It is a display aid only: a page may have any sections,
 * and an outline slot the page lacks shows as empty, ready to write. Keys are slugified headings.
 */
export const OUTLINES: Record<Entity["type"], string[]> = {
  character: ["Background", "Appearance", "Personality", "Wants", "Relationships", "Inventory"],
  place: ["Description", "History", "Notable people", "Dangers"],
  faction: ["Overview", "Goals", "Leadership", "Members", "Resources", "Rivals"],
  item: ["Description", "History", "Properties", "Current holder"],
  event: ["What happened", "Causes", "Who was involved", "Aftermath"],
  concept: ["Overview", "Details"],
  rule: ["Rule", "How it is applied"],
};

type Ref = Pick<Entity, "id" | "slug" | "name">;

/** What play has recorded about one entity in a campaign, for the entity page. */
export interface EntityProfile {
  /** Outline slots in order; `section` is null where the page has nothing under that heading yet. */
  outline: { key: string; heading: string; sectionId: string | null }[];
  /** Relationship updates that name this entity together with others. */
  relationships: { other: Ref; update: Update }[];
  /** Other entities present in the same logged scenes, most often first. */
  appearsWith: { other: Ref; scenes: number }[];
  /** Item updates that touch this entity. */
  items: Update[];
  /** Updates this entity is recorded as knowing (player view: only those the PC also knows). */
  knows: Update[];
  /** Logged scenes this entity was present in, or that took place here. */
  scenes: (Pick<Scene, "id" | "chapter" | "number" | "summaryMd"> & { place: Ref | null })[];
  /** Campaign threads tagged with this entity. */
  threads: Thread[];
  /** The PC sheet, when this entity is the PC. */
  pcSheet: PcSheet | null;
}

/** Who last wrote something, when, and in which scene (UX review #3). Read from `versions`. */
export interface Provenance {
  versionId: string;
  author: Version["author"];
  at: string;
  /** The scene in play when the GM made the change (the last one started at or before it), in a campaign. */
  scene: { chapter: number; number: number } | null;
}

/** An AI page edit made during play that the user hasn't reviewed yet (UX review #4). */
export interface PageChange {
  /** Every unreviewed AI version of this section or summary, oldest first. Keep marks them all reviewed. */
  versionIds: string[];
  /** The first of them: Undo restores the text from before it. */
  undoVersionId: string;
  entity: Pick<Entity, "id" | "slug" | "name">;
  /** The section's id, or null for the page's Current state. */
  sectionId: string | null;
  heading: string;
  before: string;
  after: string;
  at: string;
  scene: { chapter: number; number: number } | null;
}

export interface EntityView {
  page: Entity & { sections: (Section & { knownByPc: boolean; latest: Provenance | null })[] };
  /** The last change to the Current state (summary). */
  summaryLatest: Provenance | null;
  /** How many sections the player view left out. */
  hiddenSections: number;
  updates: UpdateView[];
  hiddenUpdates: number;
  /** Newest first: the entity's own versions and its sections'. */
  history: (Version & { label: string; restorable: boolean; scene: { chapter: number; number: number } | null })[];
  profile: EntityProfile;
}

export interface Dashboard {
  campaign: Campaign;
  voiceAnchor: VoiceAnchor | null;
  pcSheet: PcSheet | null;
  openThreads: Thread[];
  resolvedThreads: Thread[];
  chapters: Chapter[];
  rulings: Ruling[];
  reviewCount: number;
  /** What the player view leaves out right now (all zero with spoilers on). */
  hidden: { gmNotes: number; secretSections: number; updates: number };
}

const summaryOf = (v: unknown): string => (v && typeof v === "object" && typeof (v as { summary?: unknown }).summary === "string" ? (v as { summary: string }).summary : "");
const bodyOf = (v: unknown): string => (v && typeof v === "object" && typeof (v as { bodyMd?: unknown }).bodyMd === "string" ? (v as { bodyMd: string }).bodyMd : "");

export const TYPE_ORDER: Entity["type"][] = ["character", "place", "faction", "item", "event", "concept", "rule"];

export class WebViews {
  constructor(readonly engine: RulesEngine) {}

  private get storage() {
    return this.engine.storage;
  }

  async scope(input: { worldId: string; campaignId?: string | null; spoilers?: boolean }): Promise<Scope | null> {
    const world = await this.storage.getWorld(input.worldId);
    if (!world) return null;
    const campaign = input.campaignId ? await this.storage.getCampaign(input.campaignId) : null;
    if (input.campaignId && (!campaign || campaign.worldId !== world.id)) return null;
    return {
      world,
      campaign,
      spoilers: campaign ? campaign.spoilersOn : !!input.spoilers,
      pc: campaign ? await this.engine.pcEntity(campaign) : null,
    };
  }

  async home(): Promise<{ world: World; campaigns: Campaign[]; entityCount: number }[]> {
    const rows = await this.engine.listWorlds();
    return Promise.all(rows.map(async (r) => ({ ...r, entityCount: (await this.storage.listEntities(r.world.id)).length })));
  }

  /** Entities grouped by type, optionally narrowed by full-text search and source. */
  async wiki(scope: Scope, filter: { query?: string; source?: Entity["source"] } = {}) {
    const campaignId = scope.campaign?.id ?? null;
    let rows: { entity: Entity; line: string }[];
    if (filter.query?.trim()) {
      rows = await this.engine.searchPages({ worldId: scope.world.id, campaignId, query: filter.query, view: scope.spoilers ? "gm" : "player" });
    } else {
      rows = (await this.storage.listEntities(scope.world.id, { campaignId })).map((e) => ({ entity: e, line: e.summary.split("\n")[0] ?? "" }));
    }
    if (filter.source) rows = rows.filter((r) => r.entity.source === filter.source);
    rows = rows.map((r) => ({ ...r, line: unescapeQuotes(r.line) }));
    const withPc = await Promise.all(rows.map(async (r) => ({ ...r, toPc: await this.toPc(scope, r.entity) })));
    return TYPE_ORDER.map((type) => ({ type, entities: withPc.filter((r) => r.entity.type === type).sort((a, b) => a.entity.name.localeCompare(b.entity.name)) })).filter(
      (g) => g.entities.length,
    );
  }

  /** A character's "To the PC" line in this campaign, or null (no campaign, not a character, no line, or hidden in the player view). */
  async toPc(scope: Scope, e: Entity): Promise<string | null> {
    if (!scope.campaign || e.type !== "character" || e.id === scope.pc?.id) return null;
    const page = await this.storage.getPage(e.id, { campaignId: scope.campaign.id });
    const s = page && findToPcSection(page.sections);
    if (!s) return null;
    if (!scope.spoilers && s.visibility === "secret" && !(await this.pcKnows(scope, "section", s.id))) return null;
    return toPcLabel(s.bodyMd);
  }

  private async pcKnows(scope: Scope, target: "update" | "section", id: string): Promise<boolean> {
    if (!scope.pc) return false;
    return (await this.storage.listKnowers(target, id)).includes(scope.pc.id);
  }

  private async describe(ids: string[]): Promise<Pick<Entity, "id" | "slug" | "name">[]> {
    const out = [];
    for (const id of ids) {
      const e = await this.storage.getEntity(id);
      if (e) out.push({ id: e.id, slug: e.slug, name: e.name });
    }
    return out;
  }

  async updateView(u: Update): Promise<UpdateView> {
    let conflict: string | null = null;
    let conflictWith: UpdateView["conflictWith"] = null;
    if (u.conflictsWith) {
      if (u.conflictsWith.type === "update") {
        const other = await this.storage.getUpdate(u.conflictsWith.id);
        conflict = other ? `Clashes with update #${other.seq} (${other.status}): ${other.bodyMd}` : "Clashes with another update.";
        if (other) conflictWith = { label: `Update #${other.seq} (${other.status})`, body: other.bodyMd };
      } else {
        const sec = await this.storage.getSection(u.conflictsWith.id);
        conflict = sec ? `Would change the locked section "${sec.heading}": ${sec.bodyMd}` : "Would change a locked section.";
        if (sec) conflictWith = { label: `Your locked section "${sec.heading}"`, body: sec.bodyMd };
      }
    }
    const campaign = await this.storage.getCampaign(u.campaignId);
    const tagTypes: UpdateView["tagTypes"] = [];
    for (const tag of u.tags) {
      if (/^ch-\d+$/.test(tag)) tagTypes.push({ tag, type: "time" });
      else {
        const e = campaign ? await this.storage.getEntityBySlug(campaign.worldId, tag) : null;
        tagTypes.push({ tag, type: e ? e.type : "other" });
      }
    }
    return { update: u, entities: await this.describe(u.entityIds), knows: await this.describe(await this.storage.listKnowers("update", u.id)), conflict, conflictWith, tagTypes };
  }

  /** Updates the current view may show: all of them in GM view, only what the PC knows in player view. */
  private async visibleUpdates(scope: Scope, updates: Update[]): Promise<{ shown: Update[]; hidden: number }> {
    if (scope.spoilers) return { shown: updates, hidden: 0 };
    const shown = [];
    for (const u of updates) if (await this.pcKnows(scope, "update", u.id)) shown.push(u);
    return { shown, hidden: updates.length - shown.length };
  }

  async entity(scope: Scope, slug: string): Promise<EntityView | null> {
    const e = await this.storage.getEntityBySlug(scope.world.id, slug);
    if (!e) return null;
    if (e.campaignId && e.campaignId !== scope.campaign?.id) return null;
    const page = (await this.storage.getPage(e.id, { campaignId: scope.campaign?.id ?? null }))!;
    const sceneAt = await this.sceneFinder(scope);
    const prov = (v: Version | undefined): Provenance | null => (v ? { versionId: v.id, author: v.author, at: v.createdAt, scene: v.author === "ai" ? sceneAt(v.createdAt) : null } : null);
    const newest = (vs: Version[]) => vs.reduce<Version | undefined>((m, v) => (!m || v.createdAt >= m.createdAt ? v : m), undefined);
    const sections = [];
    let hiddenSections = 0;
    const history: EntityView["history"] = [];
    for (const s of page.sections) {
      const knownByPc = s.visibility === "secret" && (await this.pcKnows(scope, "section", s.id));
      if (!scope.spoilers && s.visibility === "secret" && !knownByPc) {
        hiddenSections++;
        continue;
      }
      const vs = await this.storage.listVersions({ objectType: "section", objectId: s.id });
      sections.push({ ...s, knownByPc, latest: prov(newest(vs)) });
      for (const v of vs) history.push({ ...v, label: `Section "${s.heading}"`, restorable: v.after !== null, scene: v.author === "ai" ? sceneAt(v.createdAt) : null });
    }
    let updates: UpdateView[] = [];
    let hiddenUpdates = 0;
    if (scope.campaign) {
      const all = (await this.storage.listUpdates(scope.campaign.id, { entityId: e.id })).reverse();
      const v = await this.visibleUpdates(scope, all);
      updates = await Promise.all(v.shown.map((u) => this.updateView(u)));
      hiddenUpdates = v.hidden;
    }
    const pageVersions = await this.storage.listVersions({ objectType: "entity", objectId: e.id });
    for (const v of pageVersions) history.push({ ...v, label: "Page", restorable: v.after !== null, scene: v.author === "ai" ? sceneAt(v.createdAt) : null });
    history.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const summaryLatest = prov(newest(pageVersions.filter((v) => summaryOf(v.before) !== summaryOf(v.after))));
    const profile = await this.profile(scope, e, page.sections, sections);
    return { page: { ...page, sections }, summaryLatest, hiddenSections, updates, hiddenUpdates, history, profile };
  }

  /** Finds the scene in play at a moment: the campaign's last scene started at or before it. */
  private async sceneFinder(scope: Scope): Promise<(at: string) => { chapter: number; number: number } | null> {
    if (!scope.campaign) return () => null;
    const scenes = (await this.storage.listScenes(scope.campaign.id)).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
    return (at) => {
      let hit: Scene | undefined;
      for (const sc of scenes) if (sc.startedAt <= at) hit = sc;
      return hit ? { chapter: hit.chapter, number: hit.number } : null;
    };
  }

  /**
   * Page edits the GM made during play in this campaign that the user hasn't reviewed (UX review #4): AI versions
   * newer than `since` and not in `kept`, on sections and summaries the view shows, whose newest version is still
   * the GM's (an Undo or a later edit by the user takes it off the list). One row per section, newest first.
   */
  async pageChanges(scope: Scope, opts: { since?: string | null; kept?: string[] } = {}): Promise<PageChange[]> {
    if (!scope.campaign) return [];
    const kept = new Set(opts.kept ?? []);
    const prefix = `edit_entity in campaign "${scope.campaign.name}"`;
    const fresh = (await this.storage.listVersions({ author: "ai", ...(opts.since && { since: opts.since }) })).filter(
      (v) => (v.objectType === "section" || v.objectType === "entity") && v.reason?.startsWith(prefix) && !kept.has(v.id) && (!opts.since || v.createdAt > opts.since),
    );
    const byObject = new Map<string, Version[]>();
    for (const v of fresh) {
      if (v.objectType === "entity" && summaryOf(v.before) === summaryOf(v.after)) continue;
      byObject.set(v.objectId, [...(byObject.get(v.objectId) ?? []), v]);
    }
    const sceneAt = await this.sceneFinder(scope);
    const out: PageChange[] = [];
    for (const [objectId, list] of byObject) {
      list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const all = await this.storage.listVersions({ objectType: first.objectType, objectId });
      const newest = all.reduce((m, v) => (v.createdAt >= m.createdAt ? v : m), all[0]!);
      if (newest.author !== "ai") continue;
      let entity: Entity | null;
      let sectionId: string | null = null;
      let heading = "Current state";
      let before: string;
      let after: string;
      if (first.objectType === "section") {
        const sec = (last.after ?? last.before) as Section;
        entity = await this.storage.getEntity(sec.entityId);
        if (!entity) continue;
        // "To the PC" labels are short bookkeeping the GM backfills; they show on every card and aren't page prose.
        if (isToPcKey(sec.key)) continue;
        if (sec.visibility === "secret" && !scope.spoilers && !(await this.pcKnows(scope, "section", objectId))) continue;
        sectionId = objectId;
        heading = sec.heading;
        before = bodyOf(first.before);
        after = bodyOf(last.after);
      } else {
        entity = await this.storage.getEntity(objectId);
        if (!entity) continue;
        before = summaryOf(first.before);
        after = summaryOf(last.after);
      }
      if (entity.status === "rejected" || (entity.campaignId && entity.campaignId !== scope.campaign.id) || entity.worldId !== scope.world.id) continue;
      if (before === after) continue;
      out.push({
        versionIds: list.map((v) => v.id),
        undoVersionId: first.id,
        entity: { id: entity.id, slug: entity.slug, name: entity.name },
        sectionId,
        heading,
        before,
        after,
        at: last.createdAt,
        scene: sceneAt(last.createdAt),
      });
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  private async profile(scope: Scope, e: Entity, all: Section[], shown: Section[]): Promise<EntityProfile> {
    // A secret section the view hides still fills its outline slot, so the slot isn't offered as empty.
    // In a campaign, a character other than the PC also has a "To the PC" slot, first, written in the campaign layer.
    const headings = scope.campaign && e.type === "character" && e.id !== scope.pc?.id ? [TO_PC_HEADING, ...OUTLINES[e.type]] : OUTLINES[e.type];
    const outline = headings.map((heading) => {
      const key = slugify(heading);
      const sec = key === TO_PC_KEY ? findToPcSection(all) : all.find((s) => s.key === key);
      return { key, heading, sectionId: sec && shown.some((x) => x.id === sec.id) ? sec.id : sec ? "hidden" : null };
    });
    const empty: EntityProfile = { outline, relationships: [], appearsWith: [], items: [], knows: [], scenes: [], threads: [], pcSheet: null };
    const c = scope.campaign;
    if (!c) return empty;

    const refs = new Map<string, Ref | null>();
    const ref = async (id: string) => {
      if (!refs.has(id)) {
        const x = await this.storage.getEntity(id);
        refs.set(id, x ? { id: x.id, slug: x.slug, name: x.name } : null);
      }
      return refs.get(id)!;
    };
    const live = (u: Update) => u.status === "proposed" || u.status === "confirmed";

    const mine = (await this.visibleUpdates(scope, (await this.storage.listUpdates(c.id, { entityId: e.id })).filter(live))).shown;
    const relationships: EntityProfile["relationships"] = [];
    for (const u of mine.filter((x) => x.type === "relationship")) {
      for (const id of u.entityIds) {
        if (id === e.id) continue;
        const other = await ref(id);
        if (other) relationships.push({ other, update: u });
      }
    }
    const items = mine.filter((u) => u.type === "item");

    const knows: Update[] = [];
    const every = (await this.visibleUpdates(scope, (await this.storage.listUpdates(c.id)).filter(live))).shown;
    for (const u of every) if ((await this.storage.listKnowers("update", u.id)).includes(e.id)) knows.push(u);

    const scenes: EntityProfile["scenes"] = [];
    const together = new Map<string, number>();
    for (const sc of await this.storage.listScenes(c.id)) {
      if (!sc.loggedAt) continue;
      if (!sc.presentEntityIds.includes(e.id) && sc.placeEntityId !== e.id) continue;
      scenes.push({ id: sc.id, chapter: sc.chapter, number: sc.number, summaryMd: sc.summaryMd, place: sc.placeEntityId ? await ref(sc.placeEntityId) : null });
      if (sc.presentEntityIds.includes(e.id)) for (const id of sc.presentEntityIds) if (id !== e.id) together.set(id, (together.get(id) ?? 0) + 1);
    }
    const appearsWith: EntityProfile["appearsWith"] = [];
    for (const [id, n] of [...together].sort((a, b) => b[1] - a[1])) {
      const other = await ref(id);
      if (other) appearsWith.push({ other, scenes: n });
    }

    const threads = (await this.storage.listThreads(c.id)).filter((t) => t.tags.includes(e.slug));
    const pcSheet = scope.pc?.id === e.id ? await this.storage.getPcSheet(c.id) : null;
    return { outline, relationships, appearsWith, items, knows, scenes: scenes.reverse(), threads, pcSheet };
  }

  /** The review queue: proposed updates, conflicts first. Player view leaves out what the PC doesn't know. */
  async reviewQueue(scope: Scope): Promise<{ items: UpdateView[]; hidden: number }> {
    if (!scope.campaign) return { items: [], hidden: 0 };
    const v = await this.visibleUpdates(scope, await this.engine.reviewQueue(scope.campaign.id));
    return { items: await Promise.all(v.shown.map((u) => this.updateView(u))), hidden: v.hidden };
  }

  /** Pages Claude drafted that wait for approval: the world's own, plus this campaign's. Oldest layer first. */
  async pageQueue(scope: Scope): Promise<{ entity: Entity; line: string; sections: number }[]> {
    const out = [];
    for (const entity of await this.engine.proposedPages(scope.world.id, scope.campaign?.id ?? null)) {
      const page = await this.storage.getPage(entity.id, { campaignId: scope.campaign?.id ?? null });
      // The player view counts only public sections, so the count never hints that a page has a secret.
      const sections = (page?.sections ?? []).filter((s) => scope.spoilers || s.visibility === "public").length;
      out.push({ entity, line: entity.summary.split("\n")[0]?.trim() ?? "", sections });
    }
    return out;
  }

  /** Bulk-approve the minor updates this view shows (never a parked conflict). */
  async approveVisibleMinor(scope: Scope): Promise<Update[]> {
    const { items } = await this.reviewQueue(scope);
    const out = [];
    for (const i of items.filter((x) => x.update.severity === "minor" && !x.update.conflictsWith)) {
      const r = await this.engine.approveUpdate(i.update.id);
      if (r.ok) out.push(r.value);
    }
    return out;
  }

  async dashboard(scope: Scope): Promise<Dashboard | null> {
    const c = scope.campaign;
    if (!c) return null;
    const threads = await this.storage.listThreads(c.id);
    const hidden = { gmNotes: 0, secretSections: 0, updates: 0 };
    if (!scope.spoilers) {
      hidden.gmNotes = (await this.storage.listGmNotes(c.id)).length;
      hidden.updates = (await this.visibleUpdates(scope, await this.storage.listUpdates(c.id))).hidden;
      for (const e of await this.storage.listEntities(c.worldId, { campaignId: c.id })) {
        const page = await this.storage.getPage(e.id, { campaignId: c.id });
        for (const s of page?.sections ?? []) if (s.visibility === "secret" && !(await this.pcKnows(scope, "section", s.id))) hidden.secretSections++;
      }
    }
    return {
      campaign: c,
      voiceAnchor: await this.storage.getVoiceAnchor(c.id),
      pcSheet: await this.storage.getPcSheet(c.id),
      openThreads: threads.filter((t) => t.state === "open"),
      resolvedThreads: threads.filter((t) => t.state === "resolved"),
      chapters: await this.storage.listChapters(c.id),
      rulings: await this.storage.listRulings(c.worldId, c.id),
      reviewCount: (await this.reviewQueue(scope)).items.length + (await this.pageQueue(scope)).length,
      hidden,
    };
  }

  /** GM notes are visible only with spoilers on. */
  async gmNotes(scope: Scope): Promise<GmNote[] | null> {
    if (!scope.campaign || !scope.spoilers) return null;
    return this.storage.listGmNotes(scope.campaign.id);
  }
}

/** A one-line label for display: no trailing comma, semicolon, colon, dash or full stop. */
/** The short label from a To the PC section: its first line, cut at the first sentence (a GM sometimes writes more). */
export function toPcLabel(body: string): string | null {
  const line = body.trim().split("\n")[0] ?? "";
  return cleanLabel(line.split(/(?<=[.!?;])\s/)[0] ?? "") || null;
}

export function cleanLabel(s: string): string {
  return s.trim().replace(/[\s,;:.\-\u2013\u2014]+$/u, "").trim();
}

/** Undo JSON-style escaped quotes (\\" becomes ") that sometimes reach stored text. */
export function unescapeQuotes(s: string): string {
  return s.replace(/\\(["'])/g, "$1");
}
