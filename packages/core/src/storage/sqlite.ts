import { and, asc, desc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { openDb, type Db } from "../db";
import {
  GmNoteKind,
  ApprovalMode,
  CampaignSettings,
  ConflictRef,
  RulingOrigin,
  Severity,
  UpdateStatus,
  UpdateType,
  DEFAULT_SEVERITY_POLICY,
  Depth,
  EntityType,
  Kebab,
  PcSheetData,
  SeverityPolicy,
  PageStatus,
  Source,
  Visibility,
  type ObjectType,
} from "../enums";
import * as s from "../schema";
import { matchDistance, slugify } from "../slug";
import { hasLevel2Heading } from "../markdown/sections";
import {
  StorageError,
  type Campaign,
  type CampaignPatch,
  type Chapter,
  type GmNote,
  type PcSheet,
  type Thread,
  type ThreadPatch,
  type VoiceAnchor,
  type Ruling,
  type Scene,
  type ScenePatch,
  type Session,
  type Update,
  type UpdatePatch,
  type NewUpdate,
  type Entity,
  type EntityPage,
  type EntityPatch,
  type NewCampaign,
  type NewEntity,
  type NewSection,
  type NewWorld,
  type Resolution,
  type SearchHit,
  type Section,
  type SectionPatch,
  type Storage,
  type User,
  type Version,
  type World,
  type WorldPatch,
  type WriteMeta,
} from "./types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const RESERVED_SECTION_KEYS = new Set(["summary"]);
const Aliases = z.array(z.string().trim().min(1));

function check<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new StorageError("invalid", `${what}: ${r.error.issues.map((i) => i.message).join("; ")}`);
  return r.data;
}

function checkKey(key: string): string {
  check(Kebab, key, "section key");
  if (RESERVED_SECTION_KEYS.has(key)) throw new StorageError("invalid", `section key "${key}" is reserved`);
  return key;
}

function checkBody(body: string): string {
  if (hasLevel2Heading(body)) {
    throw new StorageError("invalid", "section body may not contain a level-2 heading (## ); use ### or deeper");
  }
  return body.replace(/\s+$/, "");
}

export class SqliteStorage implements Storage {
  private lastStamp = "";

  constructor(private readonly db: Db) {}

  /** Strictly increasing ISO-8601 timestamps, so "since" comparisons never tie. */
  private stamp(): string {
    let t = new Date().toISOString();
    if (t <= this.lastStamp) t = new Date(Date.parse(this.lastStamp) + 1).toISOString();
    this.lastStamp = t;
    return t;
  }

  /** Every row of every table, for tests that prove a refused write changed nothing. Not on `Storage`. */
  dump(): Record<string, unknown[]> {
    const c = this.db.$client;
    const tables = c
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' AND name NOT LIKE 'entities_fts_%' ORDER BY name")
      .all() as { name: string }[];
    return Object.fromEntries(tables.map(({ name }) => [name, c.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
  }

  static open(path = ":memory:"): SqliteStorage {
    return new SqliteStorage(openDb(path));
  }

  close(): void {
    this.db.$client.close();
  }

  /** Run `fn` and record its single version row in one transaction. */
  private write<T>(
    objectType: ObjectType,
    meta: WriteMeta,
    fn: (tx: Tx) => { result: T; objectId: string; before: unknown; after: unknown },
  ): T {
    return this.db.transaction((tx) => {
      const { result, objectId, before, after } = fn(tx);
      tx.insert(s.versions)
        .values({
          id: randomUUID(),
          objectType,
          objectId,
          before: before ?? null,
          after: after ?? null,
          author: meta.author,
          editKind: meta.editKind ?? null,
          reason: meta.reason ?? null,
          createdAt: this.stamp(),
        })
        .run();
      return result;
    });
  }

  // ---- users ----

  async createUser(input: { name: string }, meta: WriteMeta): Promise<User> {
    const user = { id: randomUUID(), name: input.name };
    return this.write("user", meta, (tx) => {
      tx.insert(s.users).values(user).run();
      return { result: user, objectId: user.id, before: null, after: user };
    });
  }

  async getUser(id: string): Promise<User | null> {
    return this.db.select().from(s.users).where(eq(s.users.id, id)).get() ?? null;
  }

  // ---- worlds ----

  async createWorld(input: NewWorld, meta: WriteMeta): Promise<World> {
    const world: World = {
      id: randomUUID(),
      ownerId: input.ownerId,
      name: input.name,
      pitch: input.pitch ?? "",
      depth: check(Depth, input.depth, "depth"),
      defaultApprovalMode: check(ApprovalMode, input.defaultApprovalMode, "approval mode"),
      asOfStoryTime: input.asOfStoryTime?.trim() || null,
    };
    return this.write("world", meta, (tx) => {
      tx.insert(s.worlds).values(world).run();
      tx.insert(s.permissions)
        .values({ subjectType: "world", subjectId: world.id, userId: world.ownerId, role: "owner" })
        .run();
      return { result: world, objectId: world.id, before: null, after: world };
    });
  }

  async updateWorld(id: string, patch: WorldPatch, meta: WriteMeta): Promise<World> {
    return this.write("world", meta, (tx) => {
      const before = this.requireWorld(tx, id);
      const after: World = { ...before, ...patch };
      check(Depth, after.depth, "depth");
      check(ApprovalMode, after.defaultApprovalMode, "approval mode");
      tx.update(s.worlds).set(patch).where(eq(s.worlds.id, id)).run();
      return { result: after, objectId: id, before, after };
    });
  }

  async getWorld(id: string): Promise<World | null> {
    return this.db.select().from(s.worlds).where(eq(s.worlds.id, id)).get() ?? null;
  }

  async listWorlds(ownerId?: string): Promise<World[]> {
    const q = this.db.select().from(s.worlds);
    return (ownerId ? q.where(eq(s.worlds.ownerId, ownerId)) : q).orderBy(asc(s.worlds.name)).all();
  }

  private requireWorld(tx: Tx | Db, id: string): World {
    const w = tx.select().from(s.worlds).where(eq(s.worlds.id, id)).get();
    if (!w) throw new StorageError("not_found", `world ${id} not found`);
    return w;
  }

  // ---- campaigns ----

  async createCampaign(input: NewCampaign, meta: WriteMeta): Promise<Campaign> {
    const campaign: Campaign = {
      id: randomUUID(),
      worldId: input.worldId,
      ownerId: input.ownerId,
      name: input.name,
      settings: check(CampaignSettings, input.settings ?? {}, "settings"),
      approvalMode: check(ApprovalMode, input.approvalMode, "approval mode"),
      severityPolicy: check(SeverityPolicy, input.severityPolicy ?? DEFAULT_SEVERITY_POLICY, "severity policy"),
      asOfStoryTime: input.asOfStoryTime ?? null,
      currentChapter: 1,
      spoilersOn: false,
      lastSessionAt: null,
    };
    return this.write("campaign", meta, (tx) => {
      this.requireWorld(tx, input.worldId);
      tx.insert(s.campaigns).values(campaign).run();
      tx.insert(s.permissions)
        .values({ subjectType: "campaign", subjectId: campaign.id, userId: campaign.ownerId, role: "owner" })
        .run();
      return { result: campaign, objectId: campaign.id, before: null, after: campaign };
    });
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    return this.db.select().from(s.campaigns).where(eq(s.campaigns.id, id)).get() ?? null;
  }

  async listCampaigns(worldId: string): Promise<Campaign[]> {
    return this.db.select().from(s.campaigns).where(eq(s.campaigns.worldId, worldId)).orderBy(asc(s.campaigns.name)).all();
  }

  async updateCampaign(id: string, patch: CampaignPatch, meta: WriteMeta): Promise<Campaign> {
    return this.write("campaign", meta, (tx) => {
      const before = this.requireCampaign(tx, id);
      const after: Campaign = { ...before, ...patch };
      check(ApprovalMode, after.approvalMode, "approval mode");
      check(SeverityPolicy, after.severityPolicy, "severity policy");
      check(CampaignSettings, after.settings, "settings");
      tx.update(s.campaigns).set(patch).where(eq(s.campaigns.id, id)).run();
      return { result: after, objectId: id, before, after };
    });
  }

  private requireCampaign(tx: Tx | Db, id: string): Campaign {
    const c = tx.select().from(s.campaigns).where(eq(s.campaigns.id, id)).get();
    if (!c) throw new StorageError("not_found", `campaign ${id} not found`);
    return c;
  }

  // ---- updates, knowledge, rulings, scenes ----

  async createUpdate(input: NewUpdate, meta: WriteMeta): Promise<Update> {
    const tags = check(z.array(Kebab), input.tags, "tags");
    return this.write("update", meta, (tx) => {
      this.requireCampaign(tx, input.campaignId);
      for (const eid of [...input.entityIds, ...(input.knows ?? [])]) this.requireEntity(tx, eid);
      const last = tx
        .select({ seq: s.updates.seq })
        .from(s.updates)
        .where(eq(s.updates.campaignId, input.campaignId))
        .orderBy(desc(s.updates.seq))
        .get();
      const update: Update = {
        id: randomUUID(),
        campaignId: input.campaignId,
        seq: (last?.seq ?? 0) + 1,
        entityIds: [...new Set(input.entityIds)],
        tags: [...new Set(tags)],
        type: check(UpdateType, input.type, "type"),
        severity: check(Severity, input.severity, "severity"),
        status: check(UpdateStatus, input.status, "status"),
        storyTime: input.storyTime ?? null,
        chapter: input.chapter ?? null,
        sceneId: input.sceneId ?? null,
        bodyMd: input.bodyMd.replace(/\s+$/, ""),
        supersedesId: input.supersedesId ?? null,
        conflictsWith: input.conflictsWith ? check(ConflictRef, input.conflictsWith, "conflicts_with") : null,
        author: meta.author,
      };
      tx.insert(s.updates).values(update).run();
      const knows = [...new Set(input.knows ?? [])];
      if (knows.length) {
        tx.insert(s.knowledge)
          .values(knows.map((holderEntityId) => ({ holderEntityId, targetType: "update" as const, targetId: update.id })))
          .run();
      }
      return { result: update, objectId: update.id, before: null, after: { ...update, knows } };
    });
  }

  async addSectionKnowers(sectionId: string, holderIds: string[], meta: WriteMeta): Promise<string[]> {
    return this.write("section", meta, (tx) => {
      const section = tx.select().from(s.sections).where(eq(s.sections.id, sectionId)).get();
      if (!section) throw new StorageError("not_found", `section ${sectionId} not found`);
      for (const eid of holderIds) this.requireEntity(tx, eid);
      const known = (k: Tx) =>
        k
          .select({ id: s.knowledge.holderEntityId })
          .from(s.knowledge)
          .where(and(eq(s.knowledge.targetType, "section"), eq(s.knowledge.targetId, sectionId)))
          .all()
          .map((r) => r.id);
      const before = known(tx);
      const fresh = [...new Set(holderIds)].filter((id) => !before.includes(id));
      if (fresh.length) {
        tx.insert(s.knowledge)
          .values(fresh.map((holderEntityId) => ({ holderEntityId, targetType: "section" as const, targetId: sectionId })))
          .run();
      }
      const after = [...before, ...fresh];
      return { result: after, objectId: sectionId, before: { ...section, knows: before }, after: { ...section, knows: after } };
    });
  }

  async updateUpdate(id: string, patch: UpdatePatch, meta: WriteMeta): Promise<Update> {
    return this.write("update", meta, (tx) => {
      const before = tx.select().from(s.updates).where(eq(s.updates.id, id)).get();
      if (!before) throw new StorageError("not_found", `update ${id} not found`);
      const after: Update = { ...before, ...patch };
      check(UpdateStatus, after.status, "status");
      check(Severity, after.severity, "severity");
      tx.update(s.updates).set(patch).where(eq(s.updates.id, id)).run();
      return { result: after, objectId: id, before, after };
    });
  }

  async getUpdate(id: string): Promise<Update | null> {
    return this.db.select().from(s.updates).where(eq(s.updates.id, id)).get() ?? null;
  }

  async getUpdateBySeq(campaignId: string, seq: number): Promise<Update | null> {
    return this.db.select().from(s.updates).where(and(eq(s.updates.campaignId, campaignId), eq(s.updates.seq, seq))).get() ?? null;
  }

  async listUpdates(campaignId: string, filter: { entityId?: string; status?: Update["status"][] } = {}): Promise<Update[]> {
    const conds: SQL[] = [eq(s.updates.campaignId, campaignId)];
    if (filter.status?.length) conds.push(inArray(s.updates.status, filter.status));
    const rows = this.db.select().from(s.updates).where(and(...conds)).orderBy(asc(s.updates.seq)).all();
    return filter.entityId ? rows.filter((u) => u.entityIds.includes(filter.entityId!)) : rows;
  }

  async listKnowers(targetType: "update" | "section", targetId: string): Promise<string[]> {
    return this.db
      .select({ id: s.knowledge.holderEntityId })
      .from(s.knowledge)
      .where(and(eq(s.knowledge.targetType, targetType), eq(s.knowledge.targetId, targetId)))
      .all()
      .map((r) => r.id);
  }

  async createRuling(
    input: { worldId: string; campaignId?: string | null; text: string; origin: Ruling["origin"] },
    meta: WriteMeta,
  ): Promise<Ruling> {
    if (!input.text.trim()) throw new StorageError("invalid", "ruling text is required");
    const ruling: Ruling = {
      id: randomUUID(),
      worldId: input.worldId,
      campaignId: input.campaignId ?? null,
      text: input.text,
      origin: check(RulingOrigin, input.origin, "origin"),
      createdAt: this.stamp(),
    };
    return this.write("ruling", meta, (tx) => {
      this.requireWorld(tx, input.worldId);
      if (ruling.campaignId) this.requireCampaign(tx, ruling.campaignId);
      tx.insert(s.rulings).values(ruling).run();
      return { result: ruling, objectId: ruling.id, before: null, after: ruling };
    });
  }

  async listRulings(worldId: string, campaignId?: string | null): Promise<Ruling[]> {
    const scope = campaignId ? or(isNull(s.rulings.campaignId), eq(s.rulings.campaignId, campaignId)) : isNull(s.rulings.campaignId);
    return this.db
      .select()
      .from(s.rulings)
      .where(and(eq(s.rulings.worldId, worldId), scope))
      .orderBy(asc(s.rulings.createdAt))
      .all();
  }

  async createScene(
    input: { campaignId: string; chapter: number; placeEntityId?: string | null; presentEntityIds?: string[] },
    meta: WriteMeta,
  ): Promise<Scene> {
    return this.write("scene", meta, (tx) => {
      this.requireCampaign(tx, input.campaignId);
      const last = tx
        .select({ number: s.scenes.number })
        .from(s.scenes)
        .where(and(eq(s.scenes.campaignId, input.campaignId), eq(s.scenes.chapter, input.chapter)))
        .orderBy(desc(s.scenes.number))
        .get();
      const scene: Scene = {
        id: randomUUID(),
        campaignId: input.campaignId,
        chapter: input.chapter,
        number: (last?.number ?? 0) + 1,
        placeEntityId: input.placeEntityId ?? null,
        presentEntityIds: input.presentEntityIds ?? [],
        summaryMd: "",
        startedAt: this.stamp(),
        loggedAt: null,
      };
      tx.insert(s.scenes).values(scene).run();
      return { result: scene, objectId: scene.id, before: null, after: scene };
    });
  }

  async updateScene(id: string, patch: ScenePatch, meta: WriteMeta): Promise<Scene> {
    return this.write("scene", meta, (tx) => {
      const before = tx.select().from(s.scenes).where(eq(s.scenes.id, id)).get();
      if (!before) throw new StorageError("not_found", `scene ${id} not found`);
      const after: Scene = { ...before, ...patch };
      tx.update(s.scenes).set(patch).where(eq(s.scenes.id, id)).run();
      return { result: after, objectId: id, before, after };
    });
  }

  async getLatestScene(campaignId: string): Promise<Scene | null> {
    return (
      this.db
        .select()
        .from(s.scenes)
        .where(eq(s.scenes.campaignId, campaignId))
        .orderBy(desc(s.scenes.startedAt))
        .get() ?? null
    );
  }

  async listScenes(campaignId: string): Promise<Scene[]> {
    return this.db.select().from(s.scenes).where(eq(s.scenes.campaignId, campaignId)).orderBy(asc(s.scenes.startedAt)).all();
  }

  // ---- threads, chapters, GM notes, voice anchor, PC sheet ----

  async createThread(
    input: { campaignId: string; title: string; bodyMd?: string; tags?: string[]; openedChapter?: number | null },
    meta: WriteMeta,
  ): Promise<Thread> {
    if (!input.title.trim()) throw new StorageError("invalid", "thread title is required");
    const thread: Thread = {
      id: randomUUID(),
      campaignId: input.campaignId,
      title: input.title.trim(),
      bodyMd: input.bodyMd ?? "",
      state: "open",
      tags: check(z.array(Kebab), input.tags ?? [], "tags"),
      openedChapter: input.openedChapter ?? null,
      resolvedChapter: null,
    };
    return this.write("thread", meta, (tx) => {
      this.requireCampaign(tx, input.campaignId);
      tx.insert(s.threads).values(thread).run();
      return { result: thread, objectId: thread.id, before: null, after: thread };
    });
  }

  async updateThread(id: string, patch: ThreadPatch, meta: WriteMeta): Promise<Thread> {
    return this.write("thread", meta, (tx) => {
      const before = tx.select().from(s.threads).where(eq(s.threads.id, id)).get();
      if (!before) throw new StorageError("not_found", `thread ${id} not found`);
      const after: Thread = { ...before, ...patch };
      check(z.array(Kebab), after.tags, "tags");
      tx.update(s.threads).set(patch).where(eq(s.threads.id, id)).run();
      return { result: after, objectId: id, before, after };
    });
  }

  async listThreads(campaignId: string, state?: Thread["state"]): Promise<Thread[]> {
    const conds: SQL[] = [eq(s.threads.campaignId, campaignId)];
    if (state) conds.push(eq(s.threads.state, state));
    return this.db.select().from(s.threads).where(and(...conds)).orderBy(asc(s.threads.title)).all();
  }

  async createChapter(
    input: { campaignId: string; number: number; title: string; summaryMd: string; closedAt?: string | null },
    meta: WriteMeta,
  ): Promise<Chapter> {
    const chapter: Chapter = { id: randomUUID(), ...input, closedAt: input.closedAt ?? null };
    return this.write("chapter", meta, (tx) => {
      this.requireCampaign(tx, input.campaignId);
      tx.insert(s.chapters).values(chapter).run();
      return { result: chapter, objectId: chapter.id, before: null, after: chapter };
    });
  }

  async listChapters(campaignId: string): Promise<Chapter[]> {
    return this.db.select().from(s.chapters).where(eq(s.chapters.campaignId, campaignId)).orderBy(asc(s.chapters.number)).all();
  }

  async createGmNote(input: Omit<GmNote, "id">, meta: WriteMeta): Promise<GmNote> {
    const note: GmNote = { id: randomUUID(), ...input, kind: check(GmNoteKind, input.kind, "kind"), key: check(Kebab, input.key, "key") };
    return this.write("gm_note", meta, (tx) => {
      this.requireCampaign(tx, input.campaignId);
      const dup = tx
        .select()
        .from(s.gmNotes)
        .where(and(eq(s.gmNotes.campaignId, note.campaignId), eq(s.gmNotes.kind, note.kind), eq(s.gmNotes.key, note.key)))
        .get();
      if (dup) throw new StorageError("duplicate", `a ${note.kind} note "${note.key}" already exists`);
      tx.insert(s.gmNotes).values(note).run();
      return { result: note, objectId: note.id, before: null, after: note };
    });
  }

  async updateGmNote(id: string, patch: Partial<Pick<GmNote, "bodyMd" | "data">>, meta: WriteMeta): Promise<GmNote> {
    return this.write("gm_note", meta, (tx) => {
      const before = tx.select().from(s.gmNotes).where(eq(s.gmNotes.id, id)).get();
      if (!before) throw new StorageError("not_found", `GM note ${id} not found`);
      const after: GmNote = { ...before, ...patch };
      tx.update(s.gmNotes).set(patch).where(eq(s.gmNotes.id, id)).run();
      return { result: after, objectId: id, before, after };
    });
  }

  async listGmNotes(campaignId: string): Promise<GmNote[]> {
    return this.db.select().from(s.gmNotes).where(eq(s.gmNotes.campaignId, campaignId)).orderBy(asc(s.gmNotes.kind), asc(s.gmNotes.key)).all();
  }

  async setVoiceAnchor(anchor: VoiceAnchor, meta: WriteMeta): Promise<VoiceAnchor> {
    return this.write("voice_anchor", meta, (tx) => {
      this.requireCampaign(tx, anchor.campaignId);
      const before = tx.select().from(s.voiceAnchors).where(eq(s.voiceAnchors.campaignId, anchor.campaignId)).get() ?? null;
      if (before) tx.update(s.voiceAnchors).set(anchor).where(eq(s.voiceAnchors.campaignId, anchor.campaignId)).run();
      else tx.insert(s.voiceAnchors).values(anchor).run();
      return { result: anchor, objectId: anchor.campaignId, before, after: anchor };
    });
  }

  async getVoiceAnchor(campaignId: string): Promise<VoiceAnchor | null> {
    return this.db.select().from(s.voiceAnchors).where(eq(s.voiceAnchors.campaignId, campaignId)).get() ?? null;
  }

  async setPcSheet(sheet: PcSheet, meta: WriteMeta): Promise<PcSheet> {
    const data = check(PcSheetData.passthrough(), sheet.data, "PC sheet") as Record<string, unknown>;
    return this.write("pc_sheet", meta, (tx) => {
      this.requireCampaign(tx, sheet.campaignId);
      const before = tx.select().from(s.pcSheets).where(eq(s.pcSheets.campaignId, sheet.campaignId)).get() ?? null;
      if (before) tx.update(s.pcSheets).set({ data }).where(eq(s.pcSheets.campaignId, sheet.campaignId)).run();
      else tx.insert(s.pcSheets).values({ campaignId: sheet.campaignId, data }).run();
      return { result: { campaignId: sheet.campaignId, data }, objectId: sheet.campaignId, before, after: { campaignId: sheet.campaignId, data } };
    });
  }

  async getPcSheet(campaignId: string): Promise<PcSheet | null> {
    return this.db.select().from(s.pcSheets).where(eq(s.pcSheets.campaignId, campaignId)).get() ?? null;
  }

  // ---- sessions and reads (bookkeeping: no versions row) ----

  async openSession(campaignId: string): Promise<{ session: Session; previous: Session | null }> {
    return this.db.transaction((tx) => {
      this.requireCampaign(tx, campaignId);
      const previous =
        tx.select().from(s.sessions).where(eq(s.sessions.campaignId, campaignId)).orderBy(desc(s.sessions.openedAt)).get() ?? null;
      const at = this.stamp();
      tx.update(s.sessions)
        .set({ closedAt: at })
        .where(and(eq(s.sessions.campaignId, campaignId), isNull(s.sessions.closedAt)))
        .run();
      const session: Session = { id: randomUUID(), campaignId, openedAt: at, closedAt: null };
      tx.insert(s.sessions).values(session).run();
      tx.update(s.campaigns).set({ lastSessionAt: at }).where(eq(s.campaigns.id, campaignId)).run();
      return { session, previous };
    });
  }

  async closeSession(id: string): Promise<Session> {
    const session = await this.getSession(id);
    if (!session) throw new StorageError("not_found", `session ${id} not found`);
    if (session.closedAt) return session;
    const closed = { ...session, closedAt: this.stamp() };
    this.db.update(s.sessions).set({ closedAt: closed.closedAt }).where(eq(s.sessions.id, id)).run();
    return closed;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.db.select().from(s.sessions).where(eq(s.sessions.id, id)).get() ?? null;
  }

  async recordReads(sessionId: string, entityIds: string[]): Promise<void> {
    if (!entityIds.length) return;
    this.db.transaction((tx) => {
      const session = tx.select().from(s.sessions).where(eq(s.sessions.id, sessionId)).get();
      if (!session) throw new StorageError("not_found", `session ${sessionId} not found`);
      if (session.closedAt) throw new StorageError("closed", `session ${sessionId} is closed`);
      const at = this.stamp();
      tx.insert(s.reads)
        .values([...new Set(entityIds)].map((entityId) => ({ sessionId, entityId, readAt: at })))
        .run();
    });
  }

  async hasRead(sessionId: string, entityId: string): Promise<boolean> {
    return !!this.db
      .select({ e: s.reads.entityId })
      .from(s.reads)
      .where(and(eq(s.reads.sessionId, sessionId), eq(s.reads.entityId, entityId)))
      .get();
  }

  // ---- entities and sections ----

  async createEntity(input: NewEntity, meta: WriteMeta): Promise<EntityPage> {
    const entity: Entity = {
      id: randomUUID(),
      worldId: input.worldId,
      campaignId: input.campaignId ?? null,
      type: check(EntityType, input.type, "type"),
      slug: check(Kebab, input.slug ?? slugify(input.name), "slug"),
      name: input.name.trim(),
      aliases: check(Aliases, input.aliases ?? [], "aliases"),
      source: check(Source, input.source, "source"),
      summary: (input.summary ?? "").replace(/\s+$/, ""),
      status: check(PageStatus, input.status ?? "confirmed", "status"),
    };
    if (!entity.name) throw new StorageError("invalid", "name is required");
    const sectionRows = (input.sections ?? []).map((sec, i) => this.newSectionRow(entity.id, entity.campaignId, sec, i));
    const keys = new Set<string>();
    for (const r of sectionRows) {
      if (keys.has(r.key)) throw new StorageError("duplicate", `section key "${r.key}" appears twice`);
      keys.add(r.key);
    }

    return this.write("entity", meta, (tx) => {
      this.requireWorld(tx, entity.worldId);
      if (tx.select().from(s.entities).where(and(eq(s.entities.worldId, entity.worldId), eq(s.entities.slug, entity.slug))).get()) {
        throw new StorageError("duplicate", `an entity with slug "${entity.slug}" already exists in this world`);
      }
      tx.insert(s.entities).values(entity).run();
      if (sectionRows.length) tx.insert(s.sections).values(sectionRows).run();
      this.refreshFts(tx, entity.id);
      const page: EntityPage = { ...entity, sections: sectionRows };
      return { result: page, objectId: entity.id, before: null, after: page };
    });
  }

  async updateEntity(id: string, patch: EntityPatch, meta: WriteMeta): Promise<Entity> {
    return this.write("entity", meta, (tx) => {
      const before = this.requireEntity(tx, id);
      const after: Entity = { ...before, ...patch };
      check(EntityType, after.type, "type");
      check(Source, after.source, "source");
      check(PageStatus, after.status, "status");
      after.aliases = check(Aliases, after.aliases, "aliases");
      after.summary = after.summary.replace(/\s+$/, "");
      if (after.slug !== before.slug) {
        check(Kebab, after.slug, "slug");
        if (tx.select().from(s.entities).where(and(eq(s.entities.worldId, before.worldId), eq(s.entities.slug, after.slug))).get()) {
          throw new StorageError("duplicate", `an entity with slug "${after.slug}" already exists in this world`);
        }
      }
      const { id: _id, worldId: _w, campaignId: _c, ...set } = after;
      tx.update(s.entities).set(set).where(eq(s.entities.id, id)).run();
      this.refreshFts(tx, id);
      return { result: after, objectId: id, before, after };
    });
  }

  async addSection(entityId: string, input: NewSection & { campaignId?: string | null }, meta: WriteMeta): Promise<Section> {
    return this.write("section", meta, (tx) => {
      this.requireEntity(tx, entityId);
      const campaignId = input.campaignId ?? null;
      const layer = this.sectionsOf(tx, entityId, campaignId);
      const row = this.newSectionRow(entityId, campaignId, input, layer.reduce((m, r) => Math.max(m, r.order + 1), 0));
      if (layer.some((r) => r.key === row.key)) {
        throw new StorageError("duplicate", `section "${row.key}" already exists on this entity`);
      }
      tx.insert(s.sections).values(row).run();
      this.refreshFts(tx, entityId);
      return { result: row, objectId: row.id, before: null, after: row };
    });
  }

  async updateSection(id: string, patch: SectionPatch, meta: WriteMeta): Promise<Section> {
    return this.write("section", meta, (tx) => {
      const before = tx.select().from(s.sections).where(eq(s.sections.id, id)).get();
      if (!before) throw new StorageError("not_found", `section ${id} not found`);
      const after: Section = { ...before, ...patch };
      check(Visibility, after.visibility, "visibility");
      after.bodyMd = checkBody(after.bodyMd);
      const { id: _id, entityId: _e, campaignId: _c, key: _k, ...set } = after;
      tx.update(s.sections).set(set).where(eq(s.sections.id, id)).run();
      this.refreshFts(tx, before.entityId);
      return { result: after, objectId: id, before, after };
    });
  }

  async getSection(id: string): Promise<Section | null> {
    return this.db.select().from(s.sections).where(eq(s.sections.id, id)).get() ?? null;
  }

  async getEntity(id: string): Promise<Entity | null> {
    return this.db.select().from(s.entities).where(eq(s.entities.id, id)).get() ?? null;
  }

  async getEntityBySlug(worldId: string, slug: string): Promise<Entity | null> {
    return (
      this.db.select().from(s.entities).where(and(eq(s.entities.worldId, worldId), eq(s.entities.slug, slug))).get() ?? null
    );
  }

  async getPage(entityId: string, opts: { campaignId?: string | null } = {}): Promise<EntityPage | null> {
    const entity = await this.getEntity(entityId);
    if (!entity) return null;
    const world = this.sectionsOf(this.db, entityId, null);
    if (!opts.campaignId) return { ...entity, sections: world };
    const overlay = this.sectionsOf(this.db, entityId, opts.campaignId);
    const byKey = new Map(overlay.map((r) => [r.key, r]));
    const merged = world.map((r) => byKey.get(r.key) ?? r);
    const worldKeys = new Set(world.map((r) => r.key));
    merged.push(...overlay.filter((r) => !worldKeys.has(r.key)));
    return { ...entity, sections: merged };
  }

  async listEntities(
    worldId: string,
    opts: { campaignId?: string | null; type?: EntityType; status?: PageStatus[] } = {},
  ): Promise<Entity[]> {
    const conds: SQL[] = [eq(s.entities.worldId, worldId), this.scope(opts.campaignId)];
    if (opts.type) conds.push(eq(s.entities.type, opts.type));
    conds.push(inArray(s.entities.status, opts.status ?? ["proposed", "confirmed"]));
    return this.db
      .select()
      .from(s.entities)
      .where(and(...conds))
      .orderBy(asc(s.entities.type), asc(s.entities.slug))
      .all();
  }

  private scope(campaignId: string | null | undefined): SQL {
    return campaignId
      ? or(isNull(s.entities.campaignId), eq(s.entities.campaignId, campaignId))!
      : isNull(s.entities.campaignId);
  }

  private requireEntity(tx: Tx | Db, id: string): Entity {
    const e = tx.select().from(s.entities).where(eq(s.entities.id, id)).get();
    if (!e) throw new StorageError("not_found", `entity ${id} not found`);
    return e;
  }

  private sectionsOf(tx: Tx | Db, entityId: string, campaignId: string | null): Section[] {
    return tx
      .select()
      .from(s.sections)
      .where(
        and(eq(s.sections.entityId, entityId), campaignId ? eq(s.sections.campaignId, campaignId) : isNull(s.sections.campaignId)),
      )
      .orderBy(asc(s.sections.order))
      .all();
  }

  private newSectionRow(entityId: string, campaignId: string | null, sec: NewSection, order: number): Section {
    const heading = sec.heading.trim();
    if (!heading) throw new StorageError("invalid", "section heading is required");
    return {
      id: randomUUID(),
      entityId,
      campaignId,
      key: checkKey(sec.key ?? slugify(heading)),
      heading,
      bodyMd: checkBody(sec.bodyMd),
      visibility: check(Visibility, sec.visibility ?? "public", "visibility"),
      order,
      lockedByUser: sec.lockedByUser ?? false,
    };
  }

  // ---- lookup ----

  async resolveEntity(worldId: string, ref: string, opts: { campaignId?: string | null } = {}): Promise<Resolution> {
    const pool = await this.listEntities(worldId, opts);
    const byId = pool.find((e) => e.id === ref);
    if (byId) return { status: "resolved", entity: byId, matchedOn: "id" };

    const key = slugify(ref);
    const hits = new Map<string, { entity: Entity; on: "slug" | "name" | "alias" }>();
    for (const e of pool) {
      if (e.slug === key) hits.set(e.id, { entity: e, on: "slug" });
      else if (slugify(e.name) === key) hits.set(e.id, { entity: e, on: "name" });
      else if (e.aliases.some((a) => slugify(a) === key)) hits.set(e.id, { entity: e, on: "alias" });
    }
    const found = [...hits.values()];
    if (found.length === 1) return { status: "resolved", entity: found[0]!.entity, matchedOn: found[0]!.on };
    if (found.length > 1) return { status: "ambiguous", ref, candidates: found.map((h) => h.entity) };

    const scored = pool
      .map((e) => ({
        e,
        d: Math.min(...[e.slug, slugify(e.name), ...e.aliases.map(slugify)].map((k) => matchDistance(key, k))),
      }))
      .filter(({ d }) => d <= Math.max(3, key.length / 2))
      .sort((a, b) => a.d - b.d || a.e.slug.localeCompare(b.e.slug))
      .slice(0, 3);
    return { status: "unknown", ref, suggestions: scored.map(({ e }) => e) };
  }

  async search(
    worldId: string,
    query: string,
    opts: { campaignId?: string | null; type?: EntityType; limit?: number } = {},
  ): Promise<SearchHit[]> {
    const terms = query.match(/[\p{L}\p{N}]+/gu);
    if (!terms) return [];
    const match = terms.map((t) => `"${t}"*`).join(" ");
    const rows = this.db.$client
      .prepare(
        `SELECT entity_id FROM entities_fts
         WHERE entities_fts MATCH ? AND world_id = ?
         ORDER BY bm25(entities_fts, 10.0, 8.0, 3.0, 1.0)`,
      )
      .all(match, worldId) as { entity_id: string }[];
    const pool = new Map((await this.listEntities(worldId, opts)).map((e) => [e.id, e]));
    const hits: SearchHit[] = [];
    for (const { entity_id } of rows) {
      const entity = pool.get(entity_id);
      if (!entity || (opts.type && entity.type !== opts.type)) continue;
      hits.push({ entity, line: entity.summary.split("\n")[0]?.trim() || entity.name });
      if (hits.length >= (opts.limit ?? 20)) break;
    }
    return hits;
  }

  /** Rebuild one entity's FTS row. Derived index: not a versioned write. */
  private refreshFts(tx: Tx, entityId: string): void {
    const e = this.requireEntity(tx, entityId);
    const bodies = tx
      .select({ heading: s.sections.heading, body: s.sections.bodyMd })
      .from(s.sections)
      .where(eq(s.sections.entityId, entityId))
      .all()
      .map((r) => `${r.heading}\n${r.body}`)
      .join("\n\n");
    tx.run(sql`DELETE FROM entities_fts WHERE entity_id = ${entityId}`);
    tx.run(
      sql`INSERT INTO entities_fts (entity_id, world_id, name, aliases, summary, body)
          VALUES (${entityId}, ${e.worldId}, ${e.name}, ${e.aliases.join(" ")}, ${e.summary}, ${bodies})`,
    );
  }

  // ---- history ----

  async getVersion(id: string): Promise<Version | null> {
    return this.db.select().from(s.versions).where(eq(s.versions.id, id)).get() ?? null;
  }

  async listVersions(
    filter: { objectType?: ObjectType; objectId?: string; author?: Version["author"]; since?: string } = {},
  ): Promise<Version[]> {
    const conds: SQL[] = [];
    if (filter.author) conds.push(eq(s.versions.author, filter.author));
    if (filter.since) conds.push(gt(s.versions.createdAt, filter.since));
    if (filter.objectType) conds.push(eq(s.versions.objectType, filter.objectType));
    if (filter.objectId) conds.push(eq(s.versions.objectId, filter.objectId));
    return this.db
      .select()
      .from(s.versions)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(s.versions.createdAt))
      .all();
  }
}
