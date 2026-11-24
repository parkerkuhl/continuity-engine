import { z } from "zod";

export const Role = z.enum(["owner", "editor", "player", "viewer"]);
export const SubjectType = z.enum(["world", "campaign"]);
export const Depth = z.enum(["compact", "full"]);
export const ApprovalMode = z.enum(["review", "batch", "autopilot", "mixed"]);
export const EntityType = z.enum(["character", "place", "faction", "item", "event", "concept", "rule"]);
export const Source = z.enum(["canon", "ruling", "invention", "unverified"]);
export const Visibility = z.enum(["public", "secret"]);
export const UpdateType = z.enum([
  "new-fact",
  "status-change",
  "relationship",
  "location",
  "item",
  "knowledge",
  "death",
  "faction-shift",
  "world-rule",
]);
export const Severity = z.enum(["minor", "major"]);
export const UpdateStatus = z.enum(["proposed", "confirmed", "rejected", "retconned", "superseded"]);
export const Author = z.enum(["ai", "user"]);
export const EditKind = z.enum(["retcon", "forward"]);
export const KnowledgeTarget = z.enum(["update", "section"]);
export const RulingOrigin = z.enum(["in_play", "user_edit"]);
export const ThreadState = z.enum(["open", "resolved"]);
export const GmNoteKind = z.enum(["design", "clock", "twist", "ending", "setup", "motif"]);
export const ObjectType = z.enum([
  "user",
  "world",
  "campaign",
  "entity",
  "section",
  "update",
  "ruling",
  "thread",
  "chapter",
  "scene",
  "gm_note",
  "voice_anchor",
  "pc_sheet",
]);

export type Role = z.infer<typeof Role>;
export type Depth = z.infer<typeof Depth>;
export type ApprovalMode = z.infer<typeof ApprovalMode>;
export type EntityType = z.infer<typeof EntityType>;
export type Source = z.infer<typeof Source>;
export type Visibility = z.infer<typeof Visibility>;
export type Author = z.infer<typeof Author>;
export type EditKind = z.infer<typeof EditKind>;
export type ObjectType = z.infer<typeof ObjectType>;

/** Lowercase kebab-case: the only allowed shape for slugs, keys and tags. */
export const Kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case");

/** Approval mode per severity, used when a campaign's approval_mode is "mixed". */
export const SeverityPolicy = z.object({
  minor: ApprovalMode.exclude(["mixed"]),
  major: ApprovalMode.exclude(["mixed"]),
});
export type SeverityPolicy = z.infer<typeof SeverityPolicy>;
export const DEFAULT_SEVERITY_POLICY: SeverityPolicy = { minor: "autopilot", major: "batch" };

/** Campaign settings, mirroring the GM prompt's intake answers. */
export const CampaignSettings = z
  .object({
    genre: z.string(),
    tone: z.string(),
    difficulty: z.string(),
    length: z.string(),
    pacing: z.string(),
    dice: z.string(),
    turn_length: z.string(),
    lines: z.array(z.string()),
    veils: z.array(z.string()),
  })
  .partial();
export type CampaignSettings = z.infer<typeof CampaignSettings>;

export const ClockData = z.object({ step: z.number().int(), steps: z.number().int(), advances_on: z.string() });

export const PcSheetData = z
  .object({
    name: z.string(),
    stats: z.record(z.string(), z.unknown()),
    health: z.unknown(),
    stress: z.unknown(),
    inventory: z.array(z.unknown()),
    bonds: z.array(z.unknown()),
    trackers: z.record(z.string(), z.unknown()),
    flaw_notes: z.string(),
  })
  .partial();

/** What a parked update conflicts with: a confirmed major or user-authored update, or a user-locked section. */
export const ConflictRef = z.object({ type: z.enum(["update", "section"]), id: z.string() });
export type ConflictRef = z.infer<typeof ConflictRef>;

/** Types the server always treats as major, whatever severity the AI sets (SPEC "Approval modes"). */
export const FORCED_MAJOR_TYPES: ReadonlySet<z.infer<typeof UpdateType>> = new Set(["death", "knowledge", "faction-shift", "world-rule"]);
export type UpdateType = z.infer<typeof UpdateType>;
export type Severity = z.infer<typeof Severity>;
export type UpdateStatus = z.infer<typeof UpdateStatus>;
export type RulingOrigin = z.infer<typeof RulingOrigin>;
