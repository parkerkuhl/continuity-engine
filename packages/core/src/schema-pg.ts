/**
 * Postgres mirror of `schema.ts` (Milestone 8). Same tables, columns and indexes; only the column
 * types differ where Postgres has a native one: JSON fields are `jsonb`, booleans are `boolean`.
 * Ids stay text UUIDs and timestamps stay ISO-8601 text, so rows compare equal across backends.
 * Keep this file in step with `schema.ts`; `test/m8-schema-parity.test.ts` checks the two match.
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import {
  ApprovalMode,
  Author,
  Depth,
  EditKind,
  EntityType,
  GmNoteKind,
  PageStatus,
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
  type ConflictRef,
  type SeverityPolicy,
} from "./enums";

/** Zod enum values as the non-empty tuple Drizzle needs to type enum columns. */
const values = <T extends string>(e: { options: readonly T[] }) => e.options as unknown as [T, ...T[]];
const id = () => text("id").primaryKey();
const now = () => sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const json = <T>(name: string) => jsonb(name).$type<T>();

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
});

export const permissions = pgTable(
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

export const worlds = pgTable("worlds", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  pitch: text("pitch").notNull().default(""),
  depth: text("depth", { enum: values(Depth) }).notNull(),
  defaultApprovalMode: text("default_approval_mode", { enum: values(ApprovalMode) }).notNull(),
  asOfStoryTime: text("as_of_story_time"),
});

export const campaigns = pgTable("campaigns", {
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
  spoilersOn: boolean("spoilers_on").notNull().default(false),
  lastSessionAt: text("last_session_at"),
});

export const entities = pgTable(
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
    status: text("status", { enum: values(PageStatus) }).notNull().default("confirmed"),
  },
  (t) => [uniqueIndex("entities_world_slug").on(t.worldId, t.slug), index("entities_campaign").on(t.campaignId)],
);

export const sections = pgTable(
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
    lockedByUser: boolean("locked_by_user").notNull().default(false),
  },
  (t) => [index("sections_entity").on(t.entityId, t.campaignId)],
);

export const updates = pgTable(
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
    /** Set when the update is parked as a conflict (SPEC "Conflicts"). Not in the data model table; added in M2. */
    conflictsWith: json<ConflictRef>("conflicts_with"),
    author: text("author", { enum: values(Author) }).notNull(),
  },
  (t) => [uniqueIndex("updates_campaign_seq").on(t.campaignId, t.seq)],
);

export const knowledge = pgTable(
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

export const rulings = pgTable("rulings", {
  id: id(),
  worldId: text("world_id")
    .notNull()
    .references(() => worlds.id),
  campaignId: text("campaign_id").references(() => campaigns.id),
  text: text("text").notNull(),
  origin: text("origin", { enum: values(RulingOrigin) }).notNull(),
  createdAt: text("created_at").notNull().default(now()),
});

export const threads = pgTable("threads", {
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

export const chapters = pgTable("chapters", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  summaryMd: text("summary_md").notNull().default(""),
  closedAt: text("closed_at"),
});

export const scenes = pgTable("scenes", {
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

export const gmNotes = pgTable("gm_notes", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  kind: text("kind", { enum: values(GmNoteKind) }).notNull(),
  key: text("key").notNull(),
  bodyMd: text("body_md").notNull().default(""),
  data: json<Record<string, unknown>>("data"),
});

export const voiceAnchors = pgTable("voice_anchors", {
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

export const pcSheets = pgTable("pc_sheets", {
  campaignId: text("campaign_id")
    .primaryKey()
    .references(() => campaigns.id),
  data: json<Record<string, unknown>>("data").notNull(),
});

export const sessions = pgTable("sessions", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  openedAt: text("opened_at").notNull().default(now()),
  closedAt: text("closed_at"),
});

export const reads = pgTable(
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

export const versions = pgTable(
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
