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
  PageStatus,
  ConflictRef,
  RulingOrigin,
  Severity,
  UpdateStatus,
  UpdateType,
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
  /** The in-story moment the world's pages describe; campaigns start from it. */
  asOfStoryTime: string | null;
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
  /** A page Claude drafts is proposed until the user approves it (approval mode). Rejected pages drop out of lookups. */
  status: PageStatus;
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
  asOfStoryTime?: string | null;
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
  status?: PageStatus; // defaults to confirmed
  sections?: NewSection[];
}

export type EntityPatch = Partial<Pick<Entity, "type" | "slug" | "name" | "aliases" | "source" | "summary" | "status">>;
export type SectionPatch = Partial<Pick<Section, "heading" | "bodyMd" | "visibility" | "order" | "lockedByUser">>;
export type WorldPatch = Partial<Pick<World, "name" | "pitch" | "depth" | "defaultApprovalMode" | "asOfStoryTime">>;

export type CampaignPatch = Partial<
  Pick<Campaign, "name" | "settings" | "approvalMode" | "severityPolicy" | "asOfStoryTime" | "currentChapter" | "spoilersOn">
>;

export interface Update {
  id: string;
  campaignId: string;
  seq: number;
  entityIds: string[];
  tags: string[];
  type: UpdateType;
  severity: Severity;
  status: UpdateStatus;
  storyTime: string | null;
  chapter: number | null;
  sceneId: string | null;
  bodyMd: string;
  supersedesId: string | null;
  conflictsWith: ConflictRef | null;
  author: Author;
}

export interface NewUpdate {
  campaignId: string;
  entityIds: string[];
  tags: string[];
  type: UpdateType;
  severity: Severity;
  status: UpdateStatus;
  storyTime?: string | null;
  chapter?: number | null;
  sceneId?: string | null;
  bodyMd: string;
  supersedesId?: string | null;
  conflictsWith?: ConflictRef | null;
  /** Entity ids of everyone who knows this. Stored as `knowledge` rows in the same write. */
  knows?: string[];
}

export type UpdatePatch = Partial<Pick<Update, "status" | "severity" | "bodyMd" | "conflictsWith">>;

export interface Ruling {
  id: string;
  worldId: string;
  campaignId: string | null;
  text: string;
  origin: RulingOrigin;
  createdAt: string;
}

export interface Scene {
  id: string;
  campaignId: string;
  chapter: number;
  number: number;
  placeEntityId: string | null;
  presentEntityIds: string[];
  summaryMd: string;
  startedAt: string;
  loggedAt: string | null;
}

export type ScenePatch = Partial<Pick<Scene, "placeEntityId" | "presentEntityIds" | "summaryMd" | "loggedAt">>;

export interface Session {
  id: string;
  campaignId: string;
  openedAt: string;
  closedAt: string | null;
}

export interface Thread {
  id: string;
  campaignId: string;
  title: string;
  bodyMd: string;
  state: "open" | "resolved";
  tags: string[];
  openedChapter: number | null;
  resolvedChapter: number | null;
}
export type ThreadPatch = Partial<Pick<Thread, "title" | "bodyMd" | "state" | "tags" | "resolvedChapter">>;

export interface Chapter {
  id: string;
  campaignId: string;
  number: number;
  title: string;
  summaryMd: string;
  closedAt: string | null;
}

export interface GmNote {
  id: string;
  campaignId: string;
  kind: "design" | "clock" | "twist" | "ending" | "setup" | "motif";
  key: string;
  bodyMd: string;
  data: Record<string, unknown> | null;
}

export interface VoiceAnchor {
  campaignId: string;
  sampleVerbatim: string;
  profileMd: string;
  interiorLevel: string;
  avoidList: string[];
  voiceRulings: string[];
  scenesSinceAudit: number;
}

export interface PcSheet {
  campaignId: string;
  data: Record<string, unknown>;
}

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

  updateCampaign(id: string, patch: CampaignPatch, meta: WriteMeta): Promise<Campaign>;

  // entities and sections
  createEntity(input: NewEntity, meta: WriteMeta): Promise<EntityPage>;
  updateEntity(id: string, patch: EntityPatch, meta: WriteMeta): Promise<Entity>;
  addSection(entityId: string, input: NewSection & { campaignId?: string | null }, meta: WriteMeta): Promise<Section>;
  updateSection(id: string, patch: SectionPatch, meta: WriteMeta): Promise<Section>;
  getSection(id: string): Promise<Section | null>;
  getEntity(id: string): Promise<Entity | null>;
  getEntityBySlug(worldId: string, slug: string): Promise<Entity | null>;
  /** World sections, with same-key campaign sections overriding them when `campaignId` is given. */
  getPage(entityId: string, opts?: { campaignId?: string | null }): Promise<EntityPage | null>;
  /** World canon only by default; pass `campaignId` to include that campaign's own entities too. Rejected pages are left out. */
  listEntities(worldId: string, opts?: { campaignId?: string | null; type?: EntityType; status?: PageStatus[] }): Promise<Entity[]>;

  // updates, knowledge, rulings, scenes
  createUpdate(input: NewUpdate, meta: WriteMeta): Promise<Update>;
  updateUpdate(id: string, patch: UpdatePatch, meta: WriteMeta): Promise<Update>;
  getUpdate(id: string): Promise<Update | null>;
  getUpdateBySeq(campaignId: string, seq: number): Promise<Update | null>;
  /** In seq order. `entityId` keeps updates that touch that entity. */
  listUpdates(campaignId: string, filter?: { entityId?: string; status?: UpdateStatus[] }): Promise<Update[]>;
  /** Records that these entities know a section (a secret learned in play). Returns everyone who now knows it. */
  addSectionKnowers(sectionId: string, holderIds: string[], meta: WriteMeta): Promise<string[]>;
  /** Entity ids of everyone who knows the given update or section. */
  listKnowers(targetType: "update" | "section", targetId: string): Promise<string[]>;
  createRuling(input: { worldId: string; campaignId?: string | null; text: string; origin: RulingOrigin }, meta: WriteMeta): Promise<Ruling>;
  /** World rulings plus, when given, that campaign's own. Oldest first. */
  listRulings(worldId: string, campaignId?: string | null): Promise<Ruling[]>;
  createScene(input: { campaignId: string; chapter: number; placeEntityId?: string | null; presentEntityIds?: string[] }, meta: WriteMeta): Promise<Scene>;
  updateScene(id: string, patch: ScenePatch, meta: WriteMeta): Promise<Scene>;
  getLatestScene(campaignId: string): Promise<Scene | null>;
  listScenes(campaignId: string): Promise<Scene[]>;

  // threads, chapters, GM notes, voice anchor, PC sheet
  createThread(input: { campaignId: string; title: string; bodyMd?: string; tags?: string[]; openedChapter?: number | null }, meta: WriteMeta): Promise<Thread>;
  updateThread(id: string, patch: ThreadPatch, meta: WriteMeta): Promise<Thread>;
  listThreads(campaignId: string, state?: Thread["state"]): Promise<Thread[]>;
  createChapter(input: { campaignId: string; number: number; title: string; summaryMd: string; closedAt?: string | null }, meta: WriteMeta): Promise<Chapter>;
  listChapters(campaignId: string): Promise<Chapter[]>;
  createGmNote(input: Omit<GmNote, "id">, meta: WriteMeta): Promise<GmNote>;
  updateGmNote(id: string, patch: Partial<Pick<GmNote, "bodyMd" | "data">>, meta: WriteMeta): Promise<GmNote>;
  listGmNotes(campaignId: string): Promise<GmNote[]>;
  /** Insert or replace the campaign's voice anchor. */
  setVoiceAnchor(anchor: VoiceAnchor, meta: WriteMeta): Promise<VoiceAnchor>;
  getVoiceAnchor(campaignId: string): Promise<VoiceAnchor | null>;
  /** Insert or replace the campaign's PC sheet. */
  setPcSheet(sheet: PcSheet, meta: WriteMeta): Promise<PcSheet>;
  getPcSheet(campaignId: string): Promise<PcSheet | null>;

  // sessions and reads: bookkeeping, not content, so these write no `versions` row
  /** Closes any open session of the campaign, opens a new one, and stamps `campaigns.last_session_at`. */
  openSession(campaignId: string): Promise<{ session: Session; previous: Session | null }>;
  closeSession(id: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  recordReads(sessionId: string, entityIds: string[]): Promise<void>;
  hasRead(sessionId: string, entityId: string): Promise<boolean>;

  // lookup
  resolveEntity(worldId: string, ref: string, opts?: { campaignId?: string | null }): Promise<Resolution>;
  search(worldId: string, query: string, opts?: { campaignId?: string | null; type?: EntityType; limit?: number }): Promise<SearchHit[]>;

  // history
  listVersions(filter?: { objectType?: ObjectType; objectId?: string; author?: Author; since?: string }): Promise<Version[]>;
  getVersion(id: string): Promise<Version | null>;

  close(): void;
}

export class StorageError extends Error {
  constructor(
    public readonly code: "not_found" | "duplicate" | "invalid" | "closed",
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
