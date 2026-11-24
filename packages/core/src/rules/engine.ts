/**
 * The rules engine (SPEC "Server-enforced rules"). Every write from the MCP server and the web app goes
 * through here; nothing above packages/core calls a `Storage` write method directly.
 *
 * Each rule is checked before anything is written, so a refused call changes nothing in storage.
 * AI calls carry a session id (opened by `openCampaign`); user calls come from the web app.
 */
import { z } from "zod";
import {
  ApprovalMode,
  CampaignSettings,
  ClockData,
  Depth,
  EditKind,
  EntityType,
  GmNoteKind,
  PcSheetData,
  Source,
  FORCED_MAJOR_TYPES,
  Kebab,
  Severity,
  SeverityPolicy,
  UpdateType,
  Visibility,
  type ConflictRef,
  type UpdateStatus,
} from "../enums";
import { hasLevel2Heading } from "../markdown/sections";
import { slugify } from "../slug";
import type {
  Chapter,
  GmNote,
  PcSheet,
  Thread,
  VoiceAnchor,
  World,
  Campaign,
  Entity,
  EntityPage,
  NewUpdate,
  Ruling,
  Scene,
  Section,
  Session,
  Storage,
  Update,
  Version,
  WriteMeta,
} from "../storage/types";
import { assembleEntityContext, type EntityContext } from "./precedence";
import { ok, refuse, type Refusal, type Result } from "./result";

const TIME_TAG = /^ch-\d{2,}$/;

// ---- inputs ----

export const UpdateInput = z.object({
  entities: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  type: UpdateType,
  severity: Severity,
  body: z.string().min(1),
  story_time: z.string().optional(),
  /** seq of the update this one replaces */
  supersedes: z.number().int().positive().optional(),
  /** everyone who knows this; drives the player view */
  knows: z.array(z.string()).default([]),
  /** a section this update proposes changing, used when that section is locked by the user */
  proposes_section: z.object({ entity: z.string(), key: Kebab }).optional(),
});
export type UpdateInput = z.input<typeof UpdateInput>;

export const SectionEdit = z.object({
  key: Kebab,
  heading: z.string().min(1).optional(),
  body: z.string().optional(),
  visibility: Visibility.optional(),
});
export type SectionEdit = z.input<typeof SectionEdit>;

export interface ChangeGroup {
  /** null for changes not tied to one entity: the campaign, rulings, updates with no entity */
  entity: Entity | null;
  label: string;
  changes: Version[];
}

/**
 * Each stored tag and its type: `time` for ch-NN, otherwise the type of the entity it names. Tags are a
 * fixed set of types for now (Parker, 2026-11-24); free-form tags are planned for later.
 */
export type TagTypes = Record<string, "time" | Entity["type"]>;

export interface ChangelogEntry {
  at: string;
  author: "ai" | "user";
  editKind: "retcon" | "forward" | null;
  reason: string | null;
  objectType: Version["objectType"];
  objectId: string;
  /** Entity slugs the change touches, or a group name such as "rulings" or "scenes". */
  about: string[];
  action: "created" | "changed";
  /** Fields that differ between before and after; empty for a creation. */
  fields: string[];
  versionId: string;
}

export interface ImportItemInput {
  type: Entity["type"];
  name: string;
  aliases?: string[];
  summary?: string;
  sections?: { heading: string; body: string; key?: string; visibility?: "public" | "secret" }[];
}

interface PendingImport {
  worldId: string;
  title: string;
  entities: ImportItemInput[];
}

export interface ImportReport {
  importId: string;
  title: string;
  items: {
    index: number;
    name: string;
    type: Entity["type"];
    /** slug of the existing entity this item seems to duplicate */
    duplicateOf: string | null;
    /** fields where the file disagrees with the existing page */
    disagreements: { field: string; existing: string; incoming: string }[];
  }[];
}

export interface ChapterClosed {
  chapter: Chapter;
  /** entities touched this chapter whose summaries should be refreshed with edit_entity */
  refreshSummaries: { entity: Entity; updates: number }[];
  clocks: GmNote[];
  voiceAuditDue: boolean;
  scenesSinceAudit: number | null;
}

export interface CampaignOpened {
  session: Session;
  campaign: Campaign;
  world: World;
  voiceAnchor: VoiceAnchor | null;
  pcSheet: PcSheet | null;
  openThreads: Thread[];
  chapters: Chapter[];
  /** Logged scenes of the current chapter, oldest first, for a recap after a new chat. */
  chapterScenes: Scene[];
  /** Every ruling for this campaign and its world, oldest first. */
  rulings: Ruling[];
  /** User-authored changes since the last session, grouped by entity. Overrides chat memory. */
  changes: ChangeGroup[];
  unloggedScene: Scene | null;
  warnings: string[];
}

export interface SceneContext {
  scene: Scene;
  entities: EntityContext[];
  rulings: Ruling[];
  warnings: string[];
}

export type UpdateResult =
  | { index: number; ok: true; update: Update; status: UpdateStatus; forcedMajor: boolean; tagTypes: TagTypes }
  | { index: number; ok: false; refusal: Refusal };

export interface SceneLogged {
  scene: Scene;
  results: UpdateResult[];
  threads: Thread[];
  pcSheet: PcSheet | null;
}

export const ThreadChange = z.object({
  /** id or exact title of an existing thread; leave out to open a new one */
  thread: z.string().optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  state: z.enum(["open", "resolved"]).optional(),
  tags: z.array(Kebab).optional(),
});
export type ThreadChange = z.input<typeof ThreadChange>;

/** How many logged scenes between voice audits (close_chapter flags the audit when reached). */
export const VOICE_AUDIT_EVERY = 6;

const AI = (reason?: string): WriteMeta => ({ author: "ai", reason: reason ?? null });

export class RulesEngine {
  constructor(readonly storage: Storage) {}

  // ================= sessions =================

  /** Opens a new session (the first call of every chat) and reports what changed since the last one. */
  async openCampaign(campaignId: string): Promise<Result<CampaignOpened>> {
    const campaign = await this.storage.getCampaign(campaignId);
    if (!campaign) return refuse("not_found", `No campaign with id ${campaignId}. Call list_worlds to see campaigns.`);
    const { session, previous } = await this.storage.openSession(campaignId);
    const since = previous ? (previous.closedAt ?? previous.openedAt) : await this.campaignCreatedAt(campaignId);
    const changes = await this.changeFeed(campaign, since);
    const unloggedScene = await this.unloggedScene(campaignId);
    return ok({
      session,
      campaign: (await this.storage.getCampaign(campaignId))!,
      world: (await this.storage.getWorld(campaign.worldId))!,
      voiceAnchor: await this.storage.getVoiceAnchor(campaignId),
      pcSheet: await this.storage.getPcSheet(campaignId),
      openThreads: await this.storage.listThreads(campaignId, "open"),
      chapters: await this.storage.listChapters(campaignId),
      chapterScenes: (await this.storage.listScenes(campaignId)).filter((sc) => sc.chapter === campaign.currentChapter && sc.loggedAt),
      rulings: await this.storage.listRulings(campaign.worldId, campaignId),
      changes,
      unloggedScene,
      warnings: unloggedScene ? [unloggedWarning(unloggedScene)] : [],
    });
  }

  async closeSession(sessionId: string): Promise<Result<Session>> {
    const s = await this.storage.getSession(sessionId);
    if (!s) return refuse("not_found", `No session ${sessionId}.`);
    return ok(await this.storage.closeSession(sessionId));
  }

  private async campaignCreatedAt(campaignId: string): Promise<string> {
    const [v] = await this.storage.listVersions({ objectType: "campaign", objectId: campaignId });
    return v?.createdAt ?? "";
  }

  private async openSession(sessionId: string): Promise<Result<{ session: Session; campaign: Campaign }>> {
    const session = await this.storage.getSession(sessionId);
    if (!session) return refuse("not_found", `No session ${sessionId}. Call open_campaign first.`);
    if (session.closedAt) return refuse("session_closed", "This session was closed by a newer open_campaign. Call open_campaign again.");
    return ok({ session, campaign: (await this.storage.getCampaign(session.campaignId))! });
  }

  // ================= change feed =================

  /** Every user-authored version after `since` that belongs to this campaign or its world, grouped by entity. */
  async changeFeed(campaign: Campaign, since: string): Promise<ChangeGroup[]> {
    const groups = new Map<string, ChangeGroup>();
    for (const v of await this.storage.listVersions({ author: "user", since })) {
      for (const place of await this.placesOf(v, campaign)) {
        const g = groups.get(place.key) ?? { entity: place.entity, label: place.label, changes: [] };
        g.changes.push(v);
        groups.set(place.key, g);
      }
    }
    return [...groups.values()];
  }

  /**
   * The changelog: every change, AI and user, to this campaign and its world, oldest first.
   * Built from `versions`, so nothing is ever missing from it.
   */
  async changelog(campaignId: string, opts: { since?: string; author?: "ai" | "user" } = {}): Promise<Result<ChangelogEntry[]>> {
    const campaign = await this.storage.getCampaign(campaignId);
    if (!campaign) return refuse("not_found", `No campaign ${campaignId}.`);
    const entries: ChangelogEntry[] = [];
    for (const v of await this.storage.listVersions({ ...(opts.since && { since: opts.since }), ...(opts.author && { author: opts.author }) })) {
      const places = await this.placesOf(v, campaign);
      if (!places.length) continue;
      entries.push({
        at: v.createdAt,
        author: v.author,
        editKind: v.editKind,
        reason: v.reason,
        objectType: v.objectType,
        objectId: v.objectId,
        about: places.map((p) => p.label),
        action: v.before === null ? "created" : "changed",
        fields: changedFields(v.before, v.after),
        versionId: v.id,
      });
    }
    return ok(entries);
  }

  /** Where a version belongs for this campaign: one entry per entity it touches, or none if out of scope. */
  private async placesOf(v: Version, campaign: Campaign): Promise<{ key: string; entity: Entity | null; label: string }[]> {
    const snap = (v.after ?? v.before) as Record<string, unknown> | null;
    const inScope = (e: Entity | null): e is Entity =>
      !!e && e.worldId === campaign.worldId && (e.campaignId === null || e.campaignId === campaign.id);
    const forEntity = (e: Entity) => [{ key: e.id, entity: e, label: e.slug }];
    switch (v.objectType) {
      case "entity": {
        const e = await this.storage.getEntity(v.objectId);
        return inScope(e) ? forEntity(e) : [];
      }
      case "section": {
        const sec = snap as unknown as Section;
        if (sec.campaignId && sec.campaignId !== campaign.id) return [];
        const e = await this.storage.getEntity(sec.entityId);
        return inScope(e) ? forEntity(e) : [];
      }
      case "update": {
        const u = snap as unknown as Update;
        if (u.campaignId !== campaign.id) return [];
        if (!u.entityIds.length) return [{ key: "(updates)", entity: null, label: "updates" }];
        const out = [];
        for (const id of u.entityIds) {
          const e = await this.storage.getEntity(id);
          if (e) out.push(...forEntity(e));
        }
        return out;
      }
      case "ruling": {
        const r = snap as unknown as Ruling;
        return r.worldId === campaign.worldId && (r.campaignId === null || r.campaignId === campaign.id)
          ? [{ key: "(rulings)", entity: null, label: "rulings" }]
          : [];
      }
      case "scene":
        return (snap as unknown as Scene).campaignId === campaign.id ? [{ key: "(scenes)", entity: null, label: "scenes" }] : [];
      case "campaign":
        return v.objectId === campaign.id ? [{ key: "(campaign)", entity: null, label: "campaign settings" }] : [];
      case "world":
        return v.objectId === campaign.worldId ? [{ key: "(world)", entity: null, label: "world" }] : [];
      default:
        return [];
    }
  }

  // ================= reads =================

  /** Context for a scene. Logs every returned entity as read; starts a scene unless the last one is unlogged. */
  async getContext(input: { sessionId: string; present: string[]; place?: string }): Promise<Result<SceneContext>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;

    const present = await this.resolveAll(campaign, input.present);
    if (!present.ok) return present;
    let place: Entity | null = null;
    if (input.place) {
      const r = await this.resolve(campaign, input.place);
      if (!r.ok) return r;
      place = r.value;
    }

    const warnings: string[] = [];
    let scene = await this.unloggedScene(campaign.id);
    if (scene) warnings.push(unloggedWarning(scene));
    else {
      scene = await this.storage.createScene(
        { campaignId: campaign.id, chapter: campaign.currentChapter, placeEntityId: place?.id ?? null, presentEntityIds: present.value.map((e) => e.id) },
        AI("get_context"),
      );
    }

    const all = dedupe([...(place ? [place] : []), ...present.value]);
    await this.storage.recordReads(input.sessionId, all.map((e) => e.id));
    const entities = [];
    for (const e of all) entities.push(await assembleEntityContext(this.storage, campaign, e));
    return ok({ scene, entities, rulings: await this.storage.listRulings(campaign.worldId, campaign.id), warnings });
  }

  async readEntity(input: { sessionId: string; ref: string }): Promise<Result<{ page: EntityPage; context: EntityContext }>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    const r = await this.resolve(campaign, input.ref);
    if (!r.ok) return r;
    await this.storage.recordReads(input.sessionId, [r.value.id]);
    return ok({
      page: (await this.storage.getPage(r.value.id, { campaignId: campaign.id }))!,
      context: await assembleEntityContext(this.storage, campaign, r.value),
    });
  }

  // ================= AI writes =================

  /**
   * AI edit of a page during play. Needs a read this session; refused on user-locked sections.
   * Edits apply directly to the page (Parker's call, 2026-11-24): an existing section is changed where it
   * lives, and a new section joins the entity's own layer. Every edit is a `versions` row, so it shows in
   * `changelog`.
   */
  async editEntity(input: { sessionId: string; entity: string; summary?: string; sections?: SectionEdit[] }): Promise<Result<EntityPage>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    const r = await this.resolve(campaign, input.entity);
    if (!r.ok) return r;
    const entity = r.value;
    const read = await this.requireRead(input.sessionId, entity);
    if (!read.ok) return read;

    const edits = [];
    for (const raw of input.sections ?? []) {
      const p = SectionEdit.safeParse(raw);
      if (!p.success) return refuse("invalid", `Section edit: ${p.error.issues.map((i) => i.message).join("; ")}`);
      const edit = p.data;
      if (edit.body !== undefined && hasLevel2Heading(edit.body)) {
        return refuse("invalid", `Section "${edit.key}": use ### or deeper inside a section body, not ##.`);
      }
      const world = await this.findSection(entity.id, edit.key, null);
      const overlay = await this.findSection(entity.id, edit.key, campaign.id);
      const locked = [overlay, world].find((s) => s?.lockedByUser);
      if (locked) {
        return refuse(
          "locked_by_user",
          `Section "${edit.key}" of ${entity.slug} is locked because the user edited it. Don't edit it; log an update with proposes_section {entity: "${entity.slug}", key: "${edit.key}"} to propose the change for the user to review.`,
          { ref: entity.slug },
        );
      }
      if (!overlay && !world && !edit.heading) {
        return refuse("invalid", `${entity.slug} has no section "${edit.key}". Give a heading to add it.`);
      }
      edits.push({ edit, world, overlay });
    }

    if (input.summary !== undefined) {
      await this.storage.updateEntity(entity.id, { summary: input.summary }, AI(`edit_entity in campaign "${campaign.name}"`));
    }
    for (const { edit, world, overlay } of edits) {
      const target = overlay ?? world;
      if (target) {
        await this.storage.updateSection(
          target.id,
          { ...(edit.heading && { heading: edit.heading }), ...(edit.body !== undefined && { bodyMd: edit.body }), ...(edit.visibility && { visibility: edit.visibility }) },
          AI(`edit_entity in campaign "${campaign.name}"`),
        );
      } else {
        await this.storage.addSection(
          entity.id,
          { campaignId: entity.campaignId, key: edit.key, heading: edit.heading!, bodyMd: edit.body ?? "", visibility: edit.visibility ?? "public" },
          AI(`edit_entity in campaign "${campaign.name}"`),
        );
      }
    }
    return ok((await this.storage.getPage(entity.id, { campaignId: campaign.id }))!);
  }

  /** Main write path. The scene is logged; each update is accepted or refused on its own. */
  async logScene(input: {
    sessionId: string;
    summary: string;
    present: string[];
    place?: string;
    updates: UpdateInput[];
    threadChanges?: ThreadChange[];
    pcChanges?: Record<string, unknown>;
  }): Promise<Result<SceneLogged>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    const present = await this.resolveAll(campaign, input.present);
    if (!present.ok) return present;
    let place: Entity | null = null;
    if (input.place) {
      const r = await this.resolve(campaign, input.place);
      if (!r.ok) return r;
      place = r.value;
    }

    // Thread and PC sheet changes are checked up front too; a bad one refuses the whole call.
    const threadPlan: { existing: Thread | null; change: z.infer<typeof ThreadChange> }[] = [];
    const threads = await this.storage.listThreads(campaign.id);
    for (const raw of input.threadChanges ?? []) {
      const p = ThreadChange.safeParse(raw);
      if (!p.success) return refuse("invalid", `Thread change: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      const c = p.data;
      if (c.thread) {
        const t = threads.find((t) => t.id === c.thread || t.title.toLowerCase() === c.thread!.toLowerCase());
        if (!t) {
          return refuse("not_found", `No thread "${c.thread}". Open threads: ${threads.filter((t) => t.state === "open").map((t) => `"${t.title}"`).join(", ") || "none"}. Leave out "thread" to open a new one.`);
        }
        threadPlan.push({ existing: t, change: c });
      } else {
        if (!c.title) return refuse("invalid", "A new thread needs a title.");
        threadPlan.push({ existing: null, change: c });
      }
    }
    let pcData: Record<string, unknown> | null = null;
    if (input.pcChanges) {
      const current = (await this.storage.getPcSheet(campaign.id))?.data ?? {};
      const merged = { ...current, ...input.pcChanges };
      const p = PcSheetData.passthrough().safeParse(merged);
      if (!p.success) return refuse("invalid", `PC sheet: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      pcData = merged;
    }

    // Check every update before writing anything, so a refusal never depends on write order.
    const prepared: ({ ok: true; value: NewUpdate & { forcedMajor: boolean; tagTypes: TagTypes } } | { ok: false; refusal: Refusal })[] = [];
    for (const raw of input.updates) prepared.push(await this.prepareUpdate(campaign, input.sessionId, raw));

    let scene = await this.unloggedScene(campaign.id);
    if (!scene) {
      scene = await this.storage.createScene({ campaignId: campaign.id, chapter: campaign.currentChapter }, AI("log_scene"));
    }
    scene = await this.storage.updateScene(
      scene.id,
      {
        summaryMd: input.summary,
        presentEntityIds: present.value.map((e) => e.id),
        placeEntityId: place?.id ?? scene.placeEntityId,
        loggedAt: new Date().toISOString(),
      },
      AI("log_scene"),
    );

    const results: UpdateResult[] = [];
    for (const [index, p] of prepared.entries()) {
      if (!p.ok) {
        results.push({ index, ok: false, refusal: p.refusal });
        continue;
      }
      const { forcedMajor, tagTypes, ...newUpdate } = p.value;
      const update = await this.storage.createUpdate({ ...newUpdate, sceneId: scene.id }, AI("log_scene"));
      results.push({ index, ok: true, update, status: update.status, forcedMajor, tagTypes });
    }

    const touched: Thread[] = [];
    for (const { existing, change } of threadPlan) {
      if (existing) {
        touched.push(
          await this.storage.updateThread(
            existing.id,
            {
              ...(change.title && { title: change.title }),
              ...(change.body !== undefined && { bodyMd: change.body }),
              ...(change.tags && { tags: change.tags }),
              ...(change.state && { state: change.state, resolvedChapter: change.state === "resolved" ? campaign.currentChapter : null }),
            },
            AI("log_scene"),
          ),
        );
      } else {
        touched.push(
          await this.storage.createThread(
            { campaignId: campaign.id, title: change.title!, bodyMd: change.body ?? "", tags: change.tags ?? [], openedChapter: campaign.currentChapter },
            AI("log_scene"),
          ),
        );
      }
    }
    const pcSheet = pcData ? await this.storage.setPcSheet({ campaignId: campaign.id, data: pcData }, AI("log_scene")) : await this.storage.getPcSheet(campaign.id);
    const anchor = await this.storage.getVoiceAnchor(campaign.id);
    if (anchor) await this.storage.setVoiceAnchor({ ...anchor, scenesSinceAudit: anchor.scenesSinceAudit + 1 }, AI("log_scene"));
    return ok({ scene, results, threads: touched, pcSheet });
  }

  /** Validates one AI update against every rule and works out its stored status. Writes nothing. */
  async prepareUpdate(
    campaign: Campaign,
    sessionId: string,
    raw: UpdateInput,
  ): Promise<{ ok: true; value: NewUpdate & { forcedMajor: boolean; tagTypes: TagTypes } } | { ok: false; refusal: Refusal }> {
    const parsed = UpdateInput.safeParse(raw);
    if (!parsed.success) return refuse("invalid", `Update: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const u = parsed.data;

    const entities = await this.resolveAll(campaign, u.entities);
    if (!entities.ok) return entities;
    const knows = await this.resolveAll(campaign, u.knows);
    if (!knows.ok) return knows;

    const tags: string[] = [];
    const tagTypes: TagTypes = {};
    for (const tag of u.tags) {
      if (!Kebab.safeParse(tag).success) {
        return refuse("invalid_tag", `Tag "${tag}" must be lowercase kebab-case, e.g. "${slugish(tag)}".`, { ref: tag });
      }
      if (TIME_TAG.test(tag)) {
        tags.push(tag);
        tagTypes[tag] = "time";
        continue;
      }
      const r = await this.resolve(campaign, tag);
      if (!r.ok) {
        return refuse("invalid_tag", `Tag "${tag}" isn't a time tag (ch-NN) or a known character, place, faction, item, event, concept or rule. Free-form tags aren't supported yet. ${r.refusal.message}`, {
          ref: tag,
          suggestions: r.refusal.suggestions ?? [],
        });
      }
      tags.push(r.value.slug);
      tagTypes[r.value.slug] = r.value.type;
    }

    for (const e of entities.value) {
      const read = await this.requireRead(sessionId, e);
      if (!read.ok) return read;
    }

    // Forced-major types
    const forcedMajor = FORCED_MAJOR_TYPES.has(u.type) && u.severity !== "major";
    const severity = FORCED_MAJOR_TYPES.has(u.type) ? "major" : u.severity;

    // Conflicts: superseding a confirmed major or user-authored update, or proposing a change to a locked section
    let supersedesId: string | null = null;
    let conflictsWith: ConflictRef | null = null;
    if (u.supersedes !== undefined) {
      const target = await this.storage.getUpdateBySeq(campaign.id, u.supersedes);
      if (!target) return refuse("not_found", `There is no update #${u.supersedes} in this campaign to supersede.`);
      supersedesId = target.id;
      if (target.author === "user" || (target.status === "confirmed" && target.severity === "major")) {
        conflictsWith = { type: "update", id: target.id };
      }
    }
    if (u.proposes_section) {
      const r = await this.resolve(campaign, u.proposes_section.entity);
      if (!r.ok) return r;
      const sec =
        (await this.findSection(r.value.id, u.proposes_section.key, campaign.id)) ??
        (await this.findSection(r.value.id, u.proposes_section.key, null));
      if (!sec) return refuse("not_found", `${r.value.slug} has no section "${u.proposes_section.key}".`);
      if (sec.lockedByUser) conflictsWith = { type: "section", id: sec.id };
    }

    const status: UpdateStatus = conflictsWith ? "proposed" : statusFor(campaign, severity);
    return ok({
      campaignId: campaign.id,
      entityIds: entities.value.map((e) => e.id),
      tags,
      type: u.type,
      severity,
      status,
      storyTime: u.story_time ?? null,
      chapter: campaign.currentChapter,
      bodyMd: u.body,
      supersedesId,
      conflictsWith,
      knows: knows.value.map((e) => e.id),
      forcedMajor,
      tagTypes,
    });
  }

  /** A ruling made in play, stored verbatim. Top precedence. */
  /**
   * Changes campaign settings, the story's as-of moment, or the PC sheet outside a scene
   * (intake, or an (OOC) settings request). Settings and sheet fields are merged into what is stored.
   */
  async updateCampaign(input: {
    sessionId: string;
    settings?: CampaignSettings;
    asOf?: string;
    pcSheet?: Record<string, unknown>;
  }): Promise<Result<{ campaign: Campaign; pcSheet: PcSheet | null }>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    if (!input.settings && input.asOf === undefined && !input.pcSheet) return refuse("invalid", "Nothing to change: pass settings, as_of or pc_sheet.");
    let settings: CampaignSettings | null = null;
    if (input.settings) {
      const p = CampaignSettings.safeParse({ ...campaign.settings, ...input.settings });
      if (!p.success) return refuse("invalid", `settings: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      settings = p.data;
    }
    let pcData: Record<string, unknown> | null = null;
    if (input.pcSheet) {
      const merged = { ...((await this.storage.getPcSheet(campaign.id))?.data ?? {}), ...input.pcSheet };
      const p = PcSheetData.passthrough().safeParse(merged);
      if (!p.success) return refuse("invalid", `PC sheet: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      pcData = merged;
    }
    let updated = campaign;
    if (settings || input.asOf !== undefined) {
      updated = await this.storage.updateCampaign(
        campaign.id,
        { ...(settings && { settings }), ...(input.asOf !== undefined && { asOfStoryTime: input.asOf }) },
        AI("update_campaign"),
      );
    }
    const pcSheet = pcData ? await this.storage.setPcSheet({ campaignId: campaign.id, data: pcData }, AI("update_campaign")) : await this.storage.getPcSheet(campaign.id);
    return ok({ campaign: updated, pcSheet });
  }

  async recordRuling(input: { sessionId: string; text: string; kind?: "canon" | "voice" | "character_inner_life" }): Promise<Result<Ruling>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    if (!input.text.trim()) return refuse("invalid", "A ruling needs the user's words.");
    const kind = input.kind ?? "canon";
    const anchor = kind === "voice" ? await this.storage.getVoiceAnchor(campaign.id) : null;
    if (kind === "voice" && !anchor) return refuse("not_found", "This campaign has no voice anchor yet. Call set_voice_anchor during intake first.");
    const ruling = await this.storage.createRuling(
      { worldId: campaign.worldId, campaignId: campaign.id, text: input.text, origin: "in_play" },
      AI(`record_ruling (${kind})`),
    );
    if (anchor) await this.storage.setVoiceAnchor({ ...anchor, voiceRulings: [...anchor.voiceRulings, input.text] }, AI("record_ruling (voice)"));
    return ok(ruling);
  }

  // ================= setup and worldbuilding =================

  /** The single owner of this install (MVP: one user). Created on first use. */
  async owner(): Promise<string> {
    if (this.ownerId) return this.ownerId;
    const worlds = await this.storage.listWorlds();
    this.ownerId = worlds[0]?.ownerId ?? (await this.storage.createUser({ name: "Owner" }, { author: "user", reason: "first run" })).id;
    return this.ownerId;
  }
  private ownerId: string | null = null;

  async listWorlds(): Promise<{ world: World; campaigns: Campaign[] }[]> {
    const out = [];
    for (const world of await this.storage.listWorlds()) out.push({ world, campaigns: await this.storage.listCampaigns(world.id) });
    return out;
  }

  async createWorld(input: { name: string; pitch?: string; depth: "compact" | "full"; approvalMode: Campaign["approvalMode"] }): Promise<Result<World>> {
    if (!input.name.trim()) return refuse("invalid", "A world needs a name.");
    if (!Depth.safeParse(input.depth).success) return refuse("invalid", 'depth must be "compact" or "full".');
    if (!ApprovalMode.safeParse(input.approvalMode).success) return refuse("invalid", "approval_mode must be review, batch, autopilot or mixed.");
    return ok(
      await this.storage.createWorld(
        { ownerId: await this.owner(), name: input.name.trim(), pitch: input.pitch ?? "", depth: input.depth, defaultApprovalMode: input.approvalMode },
        AI("create_world"),
      ),
    );
  }

  /** Refused when the name or an alias already names an entity; the match is returned instead. */
  async createEntity(input: {
    worldId: string;
    campaignId?: string | null;
    type: Entity["type"];
    name: string;
    aliases?: string[];
    source: Entity["source"];
    summary?: string;
    sections?: { heading: string; body: string; key?: string; visibility?: "public" | "secret" }[];
  }): Promise<Result<EntityPage>> {
    const world = await this.storage.getWorld(input.worldId);
    if (!world) return refuse("not_found", `No world ${input.worldId}. Call list_worlds.`);
    if (input.campaignId && !(await this.storage.getCampaign(input.campaignId))) return refuse("not_found", `No campaign ${input.campaignId}.`);
    if (!EntityType.safeParse(input.type).success) return refuse("invalid", `type must be one of ${EntityType.options.join(", ")}.`);
    if (!Source.safeParse(input.source).success) return refuse("invalid", `source must be one of ${Source.options.join(", ")}.`);
    const dup = await this.findDuplicate(world.id, input.campaignId ?? null, [input.name, ...(input.aliases ?? [])]);
    if (dup) {
      return refuse(
        "duplicate",
        `"${dup.ref}" already names ${dup.entity.slug} (${dup.entity.name}). Use that entity (read_entity, then edit_entity) instead of creating a new one, or pick a different name.`,
        { ref: dup.entity.slug, suggestions: [dup.entity.slug] },
      );
    }
    for (const sec of input.sections ?? []) {
      if (hasLevel2Heading(sec.body)) return refuse("invalid", `Section "${sec.heading}": use ### or deeper inside a section body, not ##.`);
    }
    try {
      return ok(
        await this.storage.createEntity(
          {
            worldId: world.id,
            campaignId: input.campaignId ?? null,
            type: input.type,
            name: input.name,
            aliases: input.aliases ?? [],
            source: input.source,
            summary: input.summary ?? "",
            sections: (input.sections ?? []).map((s) => ({ heading: s.heading, bodyMd: s.body, ...(s.key && { key: s.key }), visibility: s.visibility ?? "public" })),
          },
          AI("create_entity"),
        ),
      );
    } catch (e) {
      return refuse("invalid", (e as Error).message);
    }
  }

  private async findDuplicate(worldId: string, campaignId: string | null, names: string[]): Promise<{ ref: string; entity: Entity } | null> {
    for (const ref of names) {
      const r = await this.storage.resolveEntity(worldId, ref, { campaignId });
      if (r.status === "resolved") return { ref, entity: r.entity };
      if (r.status === "ambiguous") return { ref, entity: r.candidates[0]! };
    }
    return null;
  }

  private imports = new Map<string, PendingImport>();

  /** Checks Claude's split of a file against the wiki. Writes nothing until confirm_import. */
  async importDocument(input: { worldId: string; title: string; entities: ImportItemInput[] }): Promise<Result<ImportReport>> {
    const world = await this.storage.getWorld(input.worldId);
    if (!world) return refuse("not_found", `No world ${input.worldId}. Call list_worlds.`);
    const items: ImportReport["items"] = [];
    for (const [index, e] of input.entities.entries()) {
      if (!EntityType.safeParse(e.type).success) return refuse("invalid", `Item ${index} ("${e.name}"): type must be one of ${EntityType.options.join(", ")}.`);
      const dup = await this.findDuplicate(world.id, null, [e.name, ...(e.aliases ?? [])]);
      const disagreements: ImportReport["items"][number]["disagreements"] = [];
      if (dup) {
        const page = (await this.storage.getPage(dup.entity.id))!;
        if (e.summary && page.summary && e.summary.trim() !== page.summary.trim()) {
          disagreements.push({ field: "summary", existing: page.summary, incoming: e.summary });
        }
        for (const s of e.sections ?? []) {
          const key = s.key ?? slugify(s.heading);
          const existing = page.sections.find((x) => x.key === key);
          if (existing && existing.bodyMd.trim() !== s.body.trim()) disagreements.push({ field: `section ${key}`, existing: existing.bodyMd, incoming: s.body });
        }
      }
      items.push({ index, name: e.name, type: e.type, duplicateOf: dup?.entity.slug ?? null, disagreements });
    }
    const importId = crypto.randomUUID();
    this.imports.set(importId, { worldId: world.id, title: input.title, entities: input.entities });
    return ok({ importId, title: input.title, items });
  }

  /** Writes the accepted items as canon. Items that duplicate an existing entity are refused one by one. */
  async confirmImport(input: { importId: string; accept: number[] }): Promise<Result<{ created: EntityPage[]; refused: { index: number; refusal: Refusal }[] }>> {
    const pending = this.imports.get(input.importId);
    if (!pending) return refuse("not_found", `No pending import ${input.importId}. Imports are held until confirmed or the server restarts; call import_document again.`);
    const created: EntityPage[] = [];
    const refused: { index: number; refusal: Refusal }[] = [];
    for (const index of [...new Set(input.accept)]) {
      const e = pending.entities[index];
      if (!e) {
        refused.push({ index, refusal: { rule: "not_found", message: `No item ${index} in this import.` } });
        continue;
      }
      const r = await this.createEntity({ worldId: pending.worldId, type: e.type, name: e.name, aliases: e.aliases ?? [], source: "canon", summary: e.summary ?? "", sections: e.sections ?? [] });
      if (r.ok) created.push(r.value);
      else refused.push({ index, refusal: r.refusal });
    }
    this.imports.delete(input.importId);
    return ok({ created, refused });
  }

  async createCampaign(input: {
    worldId: string;
    name: string;
    settings?: Campaign["settings"];
    approvalMode?: Campaign["approvalMode"];
    severityPolicy?: Campaign["severityPolicy"];
  }): Promise<Result<Campaign>> {
    const world = await this.storage.getWorld(input.worldId);
    if (!world) return refuse("not_found", `No world ${input.worldId}. Call list_worlds.`);
    const settings = CampaignSettings.safeParse(input.settings ?? {});
    if (!settings.success) return refuse("invalid", `settings: ${settings.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    if (input.approvalMode && !ApprovalMode.safeParse(input.approvalMode).success) return refuse("invalid", "approval_mode must be review, batch, autopilot or mixed.");
    if (input.severityPolicy && !SeverityPolicy.safeParse(input.severityPolicy).success) return refuse("invalid", "severity_policy needs a mode for minor and major.");
    return ok(
      await this.storage.createCampaign(
        {
          worldId: world.id,
          ownerId: world.ownerId,
          name: input.name,
          settings: settings.data,
          approvalMode: input.approvalMode ?? world.defaultApprovalMode,
          ...(input.severityPolicy && { severityPolicy: input.severityPolicy }),
        },
        AI("create_campaign"),
      ),
    );
  }

  /** Only during intake (before any scene is logged); later changes are voice rulings. */
  async setVoiceAnchor(input: { campaignId: string; sample: string; profile: string; interiorLevel: string; avoidList?: string[] }): Promise<Result<VoiceAnchor>> {
    const campaign = await this.storage.getCampaign(input.campaignId);
    if (!campaign) return refuse("not_found", `No campaign ${input.campaignId}.`);
    if ((await this.storage.listScenes(campaign.id)).some((s) => s.loggedAt)) {
      return refuse("intake_only", 'The voice anchor is set during intake only. Play has started, so record the change with record_ruling (kind "voice") using the user\'s words.');
    }
    const existing = await this.storage.getVoiceAnchor(campaign.id);
    return ok(
      await this.storage.setVoiceAnchor(
        {
          campaignId: campaign.id,
          sampleVerbatim: input.sample,
          profileMd: input.profile,
          interiorLevel: input.interiorLevel,
          avoidList: input.avoidList ?? [],
          voiceRulings: existing?.voiceRulings ?? [],
          scenesSinceAudit: 0,
        },
        AI("set_voice_anchor"),
      ),
    );
  }

  // ================= chapters and GM notes =================

  async closeChapter(input: { sessionId: string; title: string; summary: string }): Promise<Result<ChapterClosed>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    const unlogged = await this.unloggedScene(campaign.id);
    if (unlogged) return refuse("invalid", `${unloggedWarning(unlogged)} Then close the chapter.`);
    const number = campaign.currentChapter;
    const updates = (await this.storage.listUpdates(campaign.id, { status: ["confirmed", "proposed"] })).filter((u) => u.chapter === number);
    const ids = [...new Set(updates.flatMap((u) => u.entityIds))];
    const refresh: { entity: Entity; updates: number }[] = [];
    for (const id of ids) {
      const e = await this.storage.getEntity(id);
      if (e) refresh.push({ entity: e, updates: updates.filter((u) => u.entityIds.includes(id)).length });
    }
    const clocks = (await this.storage.listGmNotes(campaign.id)).filter((n) => n.kind === "clock");
    const anchor = await this.storage.getVoiceAnchor(campaign.id);
    const chapter = await this.storage.createChapter(
      { campaignId: campaign.id, number, title: input.title, summaryMd: input.summary, closedAt: new Date().toISOString() },
      AI("close_chapter"),
    );
    await this.storage.updateCampaign(campaign.id, { currentChapter: number + 1 }, AI("close_chapter"));
    // The prompt audits the voice at every chapter opening, so the count restarts with each chapter.
    if (anchor && anchor.scenesSinceAudit > 0) await this.storage.setVoiceAnchor({ ...anchor, scenesSinceAudit: 0 }, AI("close_chapter"));
    return ok({
      chapter,
      refreshSummaries: refresh,
      clocks,
      voiceAuditDue: !!anchor && anchor.scenesSinceAudit >= VOICE_AUDIT_EVERY,
      scenesSinceAudit: anchor?.scenesSinceAudit ?? null,
    });
  }

  async gmRead(input: { sessionId: string }): Promise<Result<GmNote[]>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    return ok(await this.storage.listGmNotes(open.value.campaign.id));
  }

  /** Creates or replaces a GM note. Clock data must be {step, steps, advances_on}. */
  async gmWrite(input: { sessionId: string; kind: GmNote["kind"]; key: string; body: string; data?: Record<string, unknown> }): Promise<Result<GmNote>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    if (!GmNoteKind.safeParse(input.kind).success) return refuse("invalid", `kind must be one of ${GmNoteKind.options.join(", ")}.`);
    if (!Kebab.safeParse(input.key).success) return refuse("invalid", `key "${input.key}" must be lowercase kebab-case.`);
    if (input.kind === "clock") {
      const c = ClockData.safeParse(input.data);
      if (!c.success) return refuse("invalid", "A clock needs data {step, steps, advances_on}.");
      if (c.data.step < 0 || c.data.step > c.data.steps) return refuse("invalid", `Clock step must be between 0 and ${c.data.steps}.`);
    }
    const existing = (await this.storage.listGmNotes(campaign.id)).find((n) => n.kind === input.kind && n.key === input.key);
    if (existing) return ok(await this.storage.updateGmNote(existing.id, { bodyMd: input.body, data: input.data ?? existing.data }, AI("gm_write")));
    return ok(await this.storage.createGmNote({ campaignId: campaign.id, kind: input.kind, key: input.key, bodyMd: input.body, data: input.data ?? null }, AI("gm_write")));
  }

  /** Full-text search. In player view, hits that only match secret text are dropped. */
  async searchWiki(input: { sessionId: string; query: string; type?: Entity["type"]; view?: "gm" | "player" }): Promise<Result<{ entity: Entity; line: string }[]>> {
    const open = await this.openSession(input.sessionId);
    if (!open.ok) return open;
    const { campaign } = open.value;
    const hits = await this.storage.search(campaign.worldId, input.query, { campaignId: campaign.id, ...(input.type && { type: input.type }) });
    if (input.view !== "player") return ok(hits);
    const terms = (input.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const out = [];
    for (const h of hits) {
      const page = (await this.storage.getPage(h.entity.id, { campaignId: campaign.id }))!;
      const visible = [page.name, ...page.aliases, page.summary, ...page.sections.filter((s) => s.visibility === "public").flatMap((s) => [s.heading, s.bodyMd])]
        .join(" ")
        .toLowerCase();
      const words = visible.match(/[\p{L}\p{N}]+/gu) ?? [];
      if (terms.every((t) => words.some((w) => w.startsWith(t)))) out.push(h);
    }
    return ok(out);
  }

  /** The PC's entity, from the PC sheet's name. Drives the player view. */
  async pcEntity(campaign: Campaign): Promise<Entity | null> {
    const name = (await this.storage.getPcSheet(campaign.id))?.data.name;
    if (typeof name !== "string" || !name) return null;
    const r = await this.storage.resolveEntity(campaign.worldId, name, { campaignId: campaign.id });
    return r.status === "resolved" ? r.entity : null;
  }

  /** Session lookup for tools that need the campaign. */
  async sessionCampaign(sessionId: string): Promise<Result<Campaign>> {
    const open = await this.openSession(sessionId);
    return open.ok ? ok(open.value.campaign) : open;
  }

  // ================= user writes (web app) =================

  /**
   * A user edit to a section. Changing what a section says needs an edit kind (retcon or forward).
   * The section is then locked against AI writes.
   */
  async userEditSection(input: {
    entityId: string;
    key: string;
    campaignId?: string | null;
    heading?: string;
    body?: string;
    visibility?: "public" | "secret";
    editKind?: "retcon" | "forward";
    reason?: string;
  }): Promise<Result<Section>> {
    const entity = await this.storage.getEntity(input.entityId);
    if (!entity) return refuse("not_found", `No entity ${input.entityId}.`);
    const factChange = input.body !== undefined || input.heading !== undefined;
    if (factChange && !EditKind.safeParse(input.editKind).success) {
      return refuse("edit_kind_required", "Choose whether this edit is a retcon (always true) or a change from now on (forward).");
    }
    if (input.body !== undefined && hasLevel2Heading(input.body)) return refuse("invalid", "Use ### or deeper inside a section, not ##.");
    const meta: WriteMeta = { author: "user", editKind: input.editKind ?? null, reason: input.reason ?? null };
    const existing = await this.findSection(entity.id, input.key, input.campaignId ?? null);
    if (existing) {
      return ok(
        await this.storage.updateSection(
          existing.id,
          {
            ...(input.heading !== undefined && { heading: input.heading }),
            ...(input.body !== undefined && { bodyMd: input.body }),
            ...(input.visibility && { visibility: input.visibility }),
            ...(factChange && { lockedByUser: true }),
          },
          meta,
        ),
      );
    }
    if (!input.heading) return refuse("invalid", `No section "${input.key}" yet; give a heading to add it.`);
    return ok(
      await this.storage.addSection(
        entity.id,
        {
          campaignId: input.campaignId ?? null,
          key: input.key,
          heading: input.heading,
          bodyMd: input.body ?? "",
          visibility: input.visibility ?? "public",
          lockedByUser: true,
        },
        meta,
      ),
    );
  }

  async userEditEntity(input: {
    entityId: string;
    patch: { name?: string; aliases?: string[]; summary?: string; source?: Entity["source"]; type?: Entity["type"] };
    editKind?: "retcon" | "forward";
    reason?: string;
  }): Promise<Result<Entity>> {
    const entity = await this.storage.getEntity(input.entityId);
    if (!entity) return refuse("not_found", `No entity ${input.entityId}.`);
    const factChange = input.patch.summary !== undefined || input.patch.name !== undefined || input.patch.type !== undefined;
    if (factChange && !EditKind.safeParse(input.editKind).success) {
      return refuse("edit_kind_required", "Choose whether this edit is a retcon (always true) or a change from now on (forward).");
    }
    return ok(await this.storage.updateEntity(entity.id, input.patch, { author: "user", editKind: input.editKind ?? null, reason: input.reason ?? null }));
  }

  /** Approve a proposed update. If it supersedes another, that one becomes `superseded`. */
  async approveUpdate(updateId: string): Promise<Result<Update>> {
    const u = await this.storage.getUpdate(updateId);
    if (!u) return refuse("not_found", `No update ${updateId}.`);
    if (u.status !== "proposed") return refuse("invalid", `Update #${u.seq} is ${u.status}, not proposed.`);
    const confirmed = await this.storage.updateUpdate(u.id, { status: "confirmed" }, { author: "user", reason: "approved" });
    if (u.supersedesId) {
      const old = await this.storage.getUpdate(u.supersedesId);
      if (old && old.status === "confirmed") await this.storage.updateUpdate(old.id, { status: "superseded" }, { author: "user", reason: `superseded by #${u.seq}` });
    }
    return ok(confirmed);
  }

  /** Reject, or mark retconned. Nothing is deleted: the update stays as a record. */
  async setUpdateStatus(updateId: string, status: "rejected" | "retconned"): Promise<Result<Update>> {
    const u = await this.storage.getUpdate(updateId);
    if (!u) return refuse("not_found", `No update ${updateId}.`);
    return ok(await this.storage.updateUpdate(u.id, { status }, { author: "user", reason: status }));
  }

  async setApprovalMode(campaignId: string, mode: Campaign["approvalMode"], policy?: Campaign["severityPolicy"]): Promise<Result<Campaign>> {
    if (!ApprovalMode.safeParse(mode).success) return refuse("invalid", `Unknown approval mode "${mode}".`);
    if (policy && !SeverityPolicy.safeParse(policy).success) return refuse("invalid", "Severity policy needs a mode for minor and major.");
    const c = await this.storage.getCampaign(campaignId);
    if (!c) return refuse("not_found", `No campaign ${campaignId}.`);
    return ok(await this.storage.updateCampaign(campaignId, { approvalMode: mode, ...(policy && { severityPolicy: policy }) }, { author: "user" }));
  }

  /** Proposed updates for the review queue, conflicts pinned on top. */
  async reviewQueue(campaignId: string): Promise<Update[]> {
    const proposed = await this.storage.listUpdates(campaignId, { status: ["proposed"] });
    return [...proposed.filter((u) => u.conflictsWith), ...proposed.filter((u) => !u.conflictsWith)];
  }

  /** Restore an entity, section or update to the state recorded in a version. Writes a new version. */
  async restoreVersion(versionId: string, editKind: "retcon" | "forward"): Promise<Result<unknown>> {
    const v = await this.storage.getVersion(versionId);
    if (!v) return refuse("not_found", `No version ${versionId}.`);
    const state = (v.after ?? v.before) as Record<string, unknown> | null;
    if (!state) return refuse("invalid", "That version has no recorded state.");
    const meta: WriteMeta = { author: "user", editKind, reason: `restored version ${v.id}` };
    switch (v.objectType) {
      case "entity": {
        const e = state as unknown as Entity;
        return ok(await this.storage.updateEntity(v.objectId, { type: e.type, name: e.name, aliases: e.aliases, source: e.source, summary: e.summary }, meta));
      }
      case "section": {
        const s = state as unknown as Section;
        return ok(await this.storage.updateSection(v.objectId, { heading: s.heading, bodyMd: s.bodyMd, visibility: s.visibility, lockedByUser: true }, meta));
      }
      case "update": {
        const u = state as unknown as Update;
        return ok(await this.storage.updateUpdate(v.objectId, { status: u.status, severity: u.severity, bodyMd: u.bodyMd }, meta));
      }
      default:
        return refuse("invalid", `Restoring a ${v.objectType} isn't supported.`);
    }
  }

  // ================= helpers =================

  /** Alias resolution: every reference becomes a canonical entity, or a refusal with the closest matches. */
  async resolve(campaign: Campaign, ref: string): Promise<Result<Entity>> {
    const r = await this.storage.resolveEntity(campaign.worldId, ref, { campaignId: campaign.id });
    if (r.status === "resolved") return ok(r.entity);
    if (r.status === "ambiguous") {
      const slugs = r.candidates.map((e) => e.slug);
      return refuse("ambiguous_reference", `"${ref}" matches more than one entity: ${slugs.join(", ")}. Use the slug.`, { ref, suggestions: slugs });
    }
    const slugs = r.suggestions.map((e) => e.slug);
    return refuse(
      "unknown_reference",
      slugs.length
        ? `No entity called "${ref}". Closest matches: ${slugs.join(", ")}. Use one of these, or create the entity first.`
        : `No entity called "${ref}". Create it with create_entity first, or check the spelling with search_wiki.`,
      { ref, suggestions: slugs },
    );
  }

  private async resolveAll(campaign: Campaign, refs: string[]): Promise<Result<Entity[]>> {
    const out: Entity[] = [];
    for (const ref of refs) {
      const r = await this.resolve(campaign, ref);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return ok(dedupe(out));
  }

  private async requireRead(sessionId: string, entity: Entity): Promise<Result<true>> {
    if (await this.storage.hasRead(sessionId, entity.id)) return ok(true);
    return refuse(
      "read_before_write",
      `Read ${entity.slug} before writing to it: call read_entity("${entity.slug}") or include it in get_context, then retry.`,
      { ref: entity.slug },
    );
  }

  private async findSection(entityId: string, key: string, campaignId: string | null): Promise<Section | null> {
    const page = await this.storage.getPage(entityId, { campaignId });
    return page?.sections.find((s) => s.key === key && s.campaignId === campaignId) ?? null;
  }

  private async unloggedScene(campaignId: string): Promise<Scene | null> {
    const last = await this.storage.getLatestScene(campaignId);
    return last && !last.loggedAt ? last : null;
  }
}

/** Approval modes: what status an AI write gets in this campaign. */
export function statusFor(campaign: Pick<Campaign, "approvalMode" | "severityPolicy">, severity: "minor" | "major"): UpdateStatus {
  const mode = campaign.approvalMode === "mixed" ? campaign.severityPolicy[severity] : campaign.approvalMode;
  return mode === "autopilot" ? "confirmed" : "proposed";
}

function unloggedWarning(scene: Scene): string {
  return `Scene ch-${String(scene.chapter).padStart(2, "0")}-s${scene.number} was never logged. Call log_scene for it before narrating.`;
}

function changedFields(before: unknown, after: unknown): string[] {
  if (!before || !after) return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/** The changelog as compact Markdown, one line per change. */
export function formatChangelog(entries: ChangelogEntry[]): string {
  if (!entries.length) return "_No changes._";
  return entries
    .map((e) => {
      const what = e.action === "created" ? `${e.objectType} created` : `${e.objectType} changed (${e.fields.join(", ") || "no fields"})`;
      const kind = e.editKind ? `, ${e.editKind}` : "";
      const why = e.reason ? `: ${e.reason}` : "";
      return `- ${e.at.slice(0, 16).replace("T", " ")} · ${e.author.toUpperCase()}${kind} · ${e.about.join(", ")} · ${what}${why}`;
    })
    .join("\n");
}


function dedupe(es: Entity[]): Entity[] {
  const seen = new Set<string>();
  return es.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

function slugish(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
