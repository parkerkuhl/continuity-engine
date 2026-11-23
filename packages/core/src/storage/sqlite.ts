import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { openDb, type Db } from "../db";
import {
  ApprovalMode,
  CampaignSettings,
  DEFAULT_SEVERITY_POLICY,
  Depth,
  EntityType,
  Kebab,
  SeverityPolicy,
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
  constructor(private readonly db: Db) {}

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
      after.aliases = check(Aliases, after.aliases, "aliases");
      after.summary = after.summary.replace(/\s+$/, "");
      const { id: _id, worldId: _w, campaignId: _c, slug: _s, ...set } = after;
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

  async listEntities(worldId: string, opts: { campaignId?: string | null; type?: EntityType } = {}): Promise<Entity[]> {
    const conds: SQL[] = [eq(s.entities.worldId, worldId), this.scope(opts.campaignId)];
    if (opts.type) conds.push(eq(s.entities.type, opts.type));
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

  async listVersions(filter: { objectType?: ObjectType; objectId?: string } = {}): Promise<Version[]> {
    const conds: SQL[] = [];
    if (filter.objectType) conds.push(eq(s.versions.objectType, filter.objectType));
    if (filter.objectId) conds.push(eq(s.versions.objectId, filter.objectId));
    return this.db
      .select()
      .from(s.versions)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(s.versions.createdAt), asc(sql`rowid`))
      .all();
  }
}
