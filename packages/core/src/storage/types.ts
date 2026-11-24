/**
 * The storage interface. Everything outside packages/core, and everything inside it above this layer
 * (rules engine, export/import), talks to storage only through `Storage`, so the SQLite backend can be
 * swapped for Postgres in Milestone 8.
 *
 * Contract for every write method: it runs in one transaction, it writes exactly one `versions` row,
 * and if it throws, nothing in storage changed.
 */
import type {
  ApprovalMode,
  Author,
  CampaignSettings,
  Depth,
  EditKind,
  EntityType,
  ObjectType,
  SeverityPolicy,
  Source,
  Visibility,
} from "../enums";

export interface WriteMeta {
  author: Author;
  editKind?: EditKind | null;
  reason?: string | null;
}

export interface User {
  id: string;
  name: string;
}

export interface World {
  id: string;
  ownerId: string;
  name: string;
  pitch: string;
  depth: Depth;
  defaultApprovalMode: ApprovalMode;
}

export interface Campaign {
  id: string;
  worldId: string;
  ownerId: string;
  name: string;
  settings: CampaignSettings;
  approvalMode: ApprovalMode;
  severityPolicy: SeverityPolicy;
  asOfStoryTime: string | null;
  currentChapter: number;
  spoilersOn: boolean;
  lastSessionAt: string | null;
}

export interface Section {
  id: string;
  entityId: string;
  campaignId: string | null;
  key: string;
  heading: string;
  bodyMd: string;
  visibility: Visibility;
  order: number;
  lockedByUser: boolean;
}

export interface Entity {
  id: string;
  worldId: string;
  campaignId: string | null;
  type: EntityType;
  slug: string;
  name: string;
  aliases: string[];
  source: Source;
  summary: string;
}

/** An entity with its sections (world sections, plus the campaign's own when asked for a campaign). */
export interface EntityPage extends Entity {
  sections: Section[];
}

export interface Version {
  id: string;
  objectType: ObjectType;
  objectId: string;
  before: unknown;
  after: unknown;
  author: Author;
  editKind: EditKind | null;
  reason: string | null;
  createdAt: string;
}

export interface NewWorld {
  ownerId: string;
  name: string;
  pitch?: string;
  depth: Depth;
  defaultApprovalMode: ApprovalMode;
}

export interface NewCampaign {
  worldId: string;
  ownerId: string;
  name: string;
  settings?: CampaignSettings;
  approvalMode: ApprovalMode;
  severityPolicy?: SeverityPolicy;
  asOfStoryTime?: string | null;
}

export interface NewSection {
  key?: string; // defaults to slugify(heading)
  heading: string;
  bodyMd: string;
  visibility?: Visibility;
  lockedByUser?: boolean;
}

export interface NewEntity {
  worldId: string;
  campaignId?: string | null;
  type: EntityType;
  slug?: string; // defaults to slugify(name)
  name: string;
  aliases?: string[];
  source: Source;
  summary?: string;
  sections?: NewSection[];
}

export type EntityPatch = Partial<Pick<Entity, "type" | "name" | "aliases" | "source" | "summary">>;
export type SectionPatch = Partial<Pick<Section, "heading" | "bodyMd" | "visibility" | "order" | "lockedByUser">>;
export type WorldPatch = Partial<Pick<World, "name" | "pitch" | "depth" | "defaultApprovalMode">>;

export type Resolution =
  | { status: "resolved"; entity: Entity; matchedOn: "id" | "slug" | "name" | "alias" }
  | { status: "ambiguous"; ref: string; candidates: Entity[] }
  | { status: "unknown"; ref: string; suggestions: Entity[] };

export interface SearchHit {
  entity: Entity;
  /** One line: the first line of the summary, or the name if there is none. */
  line: string;
}

export interface Storage {
  // users
  createUser(input: { name: string }, meta: WriteMeta): Promise<User>;
  getUser(id: string): Promise<User | null>;

  // worlds
  createWorld(input: NewWorld, meta: WriteMeta): Promise<World>;
  updateWorld(id: string, patch: WorldPatch, meta: WriteMeta): Promise<World>;
  getWorld(id: string): Promise<World | null>;
  listWorlds(ownerId?: string): Promise<World[]>;

  // campaigns
  createCampaign(input: NewCampaign, meta: WriteMeta): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | null>;
  listCampaigns(worldId: string): Promise<Campaign[]>;

  // entities and sections
  createEntity(input: NewEntity, meta: WriteMeta): Promise<EntityPage>;
  updateEntity(id: string, patch: EntityPatch, meta: WriteMeta): Promise<Entity>;
  addSection(entityId: string, input: NewSection & { campaignId?: string | null }, meta: WriteMeta): Promise<Section>;
  updateSection(id: string, patch: SectionPatch, meta: WriteMeta): Promise<Section>;
  getEntity(id: string): Promise<Entity | null>;
  getEntityBySlug(worldId: string, slug: string): Promise<Entity | null>;
  /** World sections, with same-key campaign sections overriding them when `campaignId` is given. */
  getPage(entityId: string, opts?: { campaignId?: string | null }): Promise<EntityPage | null>;
  /** World canon only by default; pass `campaignId` to include that campaign's own entities too. */
  listEntities(worldId: string, opts?: { campaignId?: string | null; type?: EntityType }): Promise<Entity[]>;

  // lookup
  resolveEntity(worldId: string, ref: string, opts?: { campaignId?: string | null }): Promise<Resolution>;
  search(worldId: string, query: string, opts?: { campaignId?: string | null; type?: EntityType; limit?: number }): Promise<SearchHit[]>;

  // history
  listVersions(filter?: { objectType?: ObjectType; objectId?: string }): Promise<Version[]>;

  close(): void;
}

export class StorageError extends Error {
  constructor(
    public readonly code: "not_found" | "duplicate" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
