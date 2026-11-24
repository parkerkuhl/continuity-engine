/**
 * Drizzle schema for every table in SPEC.md "Data model".
 *
 * Portability rules (the schema must move to Postgres unchanged): text UUID ids, ISO-8601 text
 * timestamps, JSON stored as text and validated with Zod at the storage boundary, booleans as integers.
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import {
  ApprovalMode,
  Author,
  Depth,
  EditKind,
  EntityType,
  GmNoteKind,
  KnowledgeTarget,
  ObjectType,
  Role,
  RulingOrigin,
  Severity,
  Source,
  SubjectType,
  ThreadState,
  UpdateStatus,
  UpdateType,
  Visibility,
  type CampaignSettings,
  type SeverityPolicy,
} from "./enums";

/** Zod enum values as the non-empty tuple Drizzle needs to type enum columns. */
const values = <T extends string>(e: { options: readonly T[] }) => e.options as unknown as [T, ...T[]];
const id = () => text("id").primaryKey();
const now = () => sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
});

export const permissions = sqliteTable(
  "permissions",
  {
    subjectType: text("subject_type", { enum: values(SubjectType) }).notNull(),
    subjectId: text("subject_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: values(Role) }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.subjectType, t.subjectId, t.userId] })],
);

export const worlds = sqliteTable("worlds", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  pitch: text("pitch").notNull().default(""),
  depth: text("depth", { enum: values(Depth) }).notNull(),
  defaultApprovalMode: text("default_approval_mode", { enum: values(ApprovalMode) }).notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: id(),
  worldId: text("world_id")
    .notNull()
    .references(() => worlds.id),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  settings: json<CampaignSettings>("settings").notNull(),
  approvalMode: text("approval_mode", { enum: values(ApprovalMode) }).notNull(),
  severityPolicy: json<SeverityPolicy>("severity_policy").notNull(),
  asOfStoryTime: text("as_of_story_time"),
  currentChapter: integer("current_chapter").notNull().default(1),
  spoilersOn: integer("spoilers_on", { mode: "boolean" }).notNull().default(false),
  lastSessionAt: text("last_session_at"),
});

export const entities = sqliteTable(
  "entities",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    campaignId: text("campaign_id").references(() => campaigns.id),
    type: text("type", { enum: values(EntityType) }).notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    aliases: json<string[]>("aliases").notNull(),
    source: text("source", { enum: values(Source) }).notNull(),
    summary: text("summary").notNull().default(""),
  },
  (t) => [uniqueIndex("entities_world_slug").on(t.worldId, t.slug), index("entities_campaign").on(t.campaignId)],
);

export const sections = sqliteTable(
  "sections",
  {
    id: id(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id),
    campaignId: text("campaign_id").references(() => campaigns.id),
    key: text("key").notNull(),
    heading: text("heading").notNull(),
    bodyMd: text("body_md").notNull(),
    visibility: text("visibility", { enum: values(Visibility) }).notNull().default("public"),
    order: integer("order").notNull(),
    lockedByUser: integer("locked_by_user", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("sections_entity").on(t.entityId, t.campaignId)],
);

export const updates = sqliteTable(
  "updates",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    seq: integer("seq").notNull(),
    entityIds: json<string[]>("entity_ids").notNull(),
    tags: json<string[]>("tags").notNull(),
    type: text("type", { enum: values(UpdateType) }).notNull(),
    severity: text("severity", { enum: values(Severity) }).notNull(),
    status: text("status", { enum: values(UpdateStatus) }).notNull(),
    storyTime: text("story_time"),
    chapter: integer("chapter"),
    sceneId: text("scene_id"),
    bodyMd: text("body_md").notNull(),
    supersedesId: text("supersedes_id"),
    author: text("author", { enum: values(Author) }).notNull(),
  },
  (t) => [uniqueIndex("updates_campaign_seq").on(t.campaignId, t.seq)],
);

export const knowledge = sqliteTable(
  "knowledge",
  {
    holderEntityId: text("holder_entity_id")
      .notNull()
      .references(() => entities.id),
    targetType: text("target_type", { enum: values(KnowledgeTarget) }).notNull(),
    targetId: text("target_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.holderEntityId, t.targetType, t.targetId] })],
);

export const rulings = sqliteTable("rulings", {
  id: id(),
  worldId: text("world_id")
    .notNull()
    .references(() => worlds.id),
  campaignId: text("campaign_id").references(() => campaigns.id),
  text: text("text").notNull(),
  origin: text("origin", { enum: values(RulingOrigin) }).notNull(),
  createdAt: text("created_at").notNull().default(now()),
});

export const threads = sqliteTable("threads", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull().default(""),
  state: text("state", { enum: values(ThreadState) }).notNull().default("open"),
  tags: json<string[]>("tags").notNull(),
  openedChapter: integer("opened_chapter"),
  resolvedChapter: integer("resolved_chapter"),
});

export const chapters = sqliteTable("chapters", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  summaryMd: text("summary_md").notNull().default(""),
  closedAt: text("closed_at"),
});

export const scenes = sqliteTable("scenes", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  chapter: integer("chapter").notNull(),
  number: integer("number").notNull(),
  placeEntityId: text("place_entity_id").references(() => entities.id),
  presentEntityIds: json<string[]>("present_entity_ids").notNull(),
  summaryMd: text("summary_md").notNull().default(""),
  startedAt: text("started_at").notNull().default(now()),
  loggedAt: text("logged_at"),
});

export const gmNotes = sqliteTable("gm_notes", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  kind: text("kind", { enum: values(GmNoteKind) }).notNull(),
  key: text("key").notNull(),
  bodyMd: text("body_md").notNull().default(""),
  data: json<Record<string, unknown>>("data"),
});

export const voiceAnchors = sqliteTable("voice_anchors", {
  campaignId: text("campaign_id")
    .primaryKey()
    .references(() => campaigns.id),
  sampleVerbatim: text("sample_verbatim").notNull(),
  profileMd: text("profile_md").notNull(),
  interiorLevel: text("interior_level").notNull(),
  avoidList: json<string[]>("avoid_list").notNull(),
  voiceRulings: json<string[]>("voice_rulings").notNull(),
  scenesSinceAudit: integer("scenes_since_audit").notNull().default(0),
});

export const pcSheets = sqliteTable("pc_sheets", {
  campaignId: text("campaign_id")
    .primaryKey()
    .references(() => campaigns.id),
  data: json<Record<string, unknown>>("data").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  openedAt: text("opened_at").notNull().default(now()),
  closedAt: text("closed_at"),
});

export const reads = sqliteTable(
  "reads",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id),
    readAt: text("read_at").notNull().default(now()),
  },
  (t) => [index("reads_session_entity").on(t.sessionId, t.entityId)],
);

export const versions = sqliteTable(
  "versions",
  {
    id: id(),
    objectType: text("object_type", { enum: values(ObjectType) }).notNull(),
    objectId: text("object_id").notNull(),
    before: json<unknown>("before"),
    after: json<unknown>("after"),
    author: text("author", { enum: values(Author) }).notNull(),
    editKind: text("edit_kind", { enum: values(EditKind) }),
    reason: text("reason"),
    createdAt: text("created_at").notNull().default(now()),
  },
  (t) => [index("versions_object").on(t.objectType, t.objectId)],
);
