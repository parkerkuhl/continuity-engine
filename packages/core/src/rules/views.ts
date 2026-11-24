/**
 * Read models for the web app (SPEC "Web app screens" and "Spoiler model").
 * Everything here reads through the Storage interface; writes stay on RulesEngine.
 *
 * Player view (spoilers off) shows public sections, plus the secret sections and the updates
 * the PC knows (knowledge rows with the PC as holder), and no GM notes. GM view shows everything.
 */
import type { Campaign, Chapter, Entity, GmNote, PcSheet, Ruling, Section, Thread, Update, Version, VoiceAnchor, World } from "../storage/types";
import type { RulesEngine } from "./engine";

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
}

export interface EntityView {
  page: Entity & { sections: (Section & { knownByPc: boolean })[] };
  /** How many sections the player view left out. */
  hiddenSections: number;
  updates: UpdateView[];
  hiddenUpdates: number;
  /** Newest first: the entity's own versions and its sections'. */
  history: (Version & { label: string; restorable: boolean })[];
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
}

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
    return TYPE_ORDER.map((type) => ({ type, entities: rows.filter((r) => r.entity.type === type).sort((a, b) => a.entity.name.localeCompare(b.entity.name)) })).filter(
      (g) => g.entities.length,
    );
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
    if (u.conflictsWith) {
      if (u.conflictsWith.type === "update") {
        const other = await this.storage.getUpdate(u.conflictsWith.id);
        conflict = other ? `Clashes with update #${other.seq} (${other.status}): ${other.bodyMd}` : "Clashes with another update.";
      } else {
        const sec = await this.storage.getSection(u.conflictsWith.id);
        conflict = sec ? `Would change the locked section "${sec.heading}": ${sec.bodyMd}` : "Would change a locked section.";
      }
    }
    return { update: u, entities: await this.describe(u.entityIds), knows: await this.describe(await this.storage.listKnowers("update", u.id)), conflict };
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
    const sections = [];
    let hiddenSections = 0;
    for (const s of page.sections) {
      const knownByPc = s.visibility === "secret" && (await this.pcKnows(scope, "section", s.id));
      if (!scope.spoilers && s.visibility === "secret" && !knownByPc) hiddenSections++;
      else sections.push({ ...s, knownByPc });
    }
    let updates: UpdateView[] = [];
    let hiddenUpdates = 0;
    if (scope.campaign) {
      const all = (await this.storage.listUpdates(scope.campaign.id, { entityId: e.id })).reverse();
      const v = await this.visibleUpdates(scope, all);
      updates = await Promise.all(v.shown.map((u) => this.updateView(u)));
      hiddenUpdates = v.hidden;
    }
    const history: EntityView["history"] = [];
    for (const v of await this.storage.listVersions({ objectType: "entity", objectId: e.id })) history.push({ ...v, label: "Page", restorable: v.after !== null });
    for (const s of page.sections) {
      if (!scope.spoilers && s.visibility === "secret" && !sections.some((x) => x.id === s.id)) continue;
      for (const v of await this.storage.listVersions({ objectType: "section", objectId: s.id })) history.push({ ...v, label: `Section "${s.heading}"`, restorable: v.after !== null });
    }
    history.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return { page: { ...page, sections }, hiddenSections, updates, hiddenUpdates, history };
  }

  /** The review queue: proposed updates, conflicts first. Player view leaves out what the PC doesn't know. */
  async reviewQueue(scope: Scope): Promise<{ items: UpdateView[]; hidden: number }> {
    if (!scope.campaign) return { items: [], hidden: 0 };
    const v = await this.visibleUpdates(scope, await this.engine.reviewQueue(scope.campaign.id));
    return { items: await Promise.all(v.shown.map((u) => this.updateView(u))), hidden: v.hidden };
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
    return {
      campaign: c,
      voiceAnchor: await this.storage.getVoiceAnchor(c.id),
      pcSheet: await this.storage.getPcSheet(c.id),
      openThreads: threads.filter((t) => t.state === "open"),
      resolvedThreads: threads.filter((t) => t.state === "resolved"),
      chapters: await this.storage.listChapters(c.id),
      rulings: await this.storage.listRulings(c.worldId, c.id),
      reviewCount: (await this.reviewQueue(scope)).items.length,
    };
  }

  /** GM notes are visible only with spoilers on. */
  async gmNotes(scope: Scope): Promise<GmNote[] | null> {
    if (!scope.campaign || !scope.spoilers) return null;
    return this.storage.listGmNotes(scope.campaign.id);
  }
}
