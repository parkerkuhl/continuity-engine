/**
 * The Continuity Engine MCP server: every tool in SPEC "MCP tools". Tools call the rules engine only.
 * Each result is compact Markdown for Claude plus a small JSON status; refusals come back as errors
 * whose text says how to fix the call.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ApprovalMode,
  CampaignSettings,
  Depth,
  EntityType,
  GmNoteKind,
  PcSheetData,
  RulesEngine,
  SeverityPolicy,
  Severity,
  Source,
  UpdateType,
  Visibility,
  renderLoadGuide,
  type Refusal,
  type Result,
} from "@continuity/core";
import { z } from "zod";
import * as md from "./render";

export const VERSION = "0.1.0";

type Status = Record<string, unknown>;

function reply(text: string, status: Status): CallToolResult {
  return { content: [{ type: "text", text }, { type: "text", text: JSON.stringify({ ok: true, ...status }) }], structuredContent: { ok: true, ...status } };
}

function refused(r: Refusal): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: md.refusalText(r) }, { type: "text", text: JSON.stringify({ ok: false, rule: r.rule, ref: r.ref ?? null }) }],
    structuredContent: { ok: false, rule: r.rule, message: r.message, suggestions: r.suggestions ?? [] },
  };
}

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sectionInput = z.object({
  heading: z.string().min(1),
  body: z.string(),
  key: kebab.optional().describe("defaults to the heading in kebab-case"),
  visibility: Visibility.optional().describe("secret sections are hidden in player view"),
});
const campaignId = z.string().describe("campaign_id from list_worlds or create_campaign");

export function createServer(engine: RulesEngine): McpServer {
  const server = new McpServer({ name: "continuity-engine", version: VERSION });
  /** The open session for each campaign in this server process (open_campaign sets it). */
  const sessions = new Map<string, string>();

  const session = (cid: string | undefined): Result<string> => {
    if (cid) {
      const s = sessions.get(cid);
      return s ? { ok: true, value: s } : { ok: false, refusal: { rule: "not_found", message: `No open session for campaign ${cid}. Call open_campaign with this campaign_id first.` } };
    }
    if (sessions.size === 1) return { ok: true, value: [...sessions.values()][0]! };
    return {
      ok: false,
      refusal: {
        rule: "not_found",
        message: sessions.size ? "More than one campaign is open; pass campaign_id." : "No campaign is open. Call open_campaign first (it must be the first call of every chat).",
      },
    };
  };

  const guard = (fn: () => Promise<CallToolResult>) => async () => {
    try {
      return await fn();
    } catch (e) {
      return refused({ rule: "invalid", message: (e as Error).message });
    }
  };

  // ---------------- setup and worldbuilding ----------------

  server.registerTool(
    "list_worlds",
    { title: "List worlds", description: "Lists every world and its campaigns with their ids. Call it to find a campaign_id before open_campaign.", inputSchema: {} },
    () =>
      guard(async () => {
        const rows = await engine.listWorlds();
        return reply(md.renderWorlds(rows), { worlds: rows.map((r) => ({ world_id: r.world.id, name: r.world.name, campaigns: r.campaigns.map((c) => ({ campaign_id: c.id, name: c.name })) })) });
      })(),
  );

  server.registerTool(
    "create_world",
    {
      title: "Create world",
      description: "Creates an empty world. The worldbuilding prompt runs the interview; this tool asks nothing itself.",
      inputSchema: {
        name: z.string().min(1),
        pitch: z.string().default(""),
        depth: Depth,
        approval_mode: ApprovalMode.describe("default approval mode for AI writes in this world, pages you draft included"),
        as_of: z.string().optional().describe("the in-story moment the world starts at, if already known"),
      },
    },
    (a) =>
      guard(async () => {
        const r = await engine.createWorld({ name: a.name, pitch: a.pitch, depth: a.depth, approvalMode: a.approval_mode, ...(a.as_of && { asOf: a.as_of }) });
        if (!r.ok) return refused(r.refusal);
        const guide = renderLoadGuide(r.value, []);
        return reply(`World "${r.value.name}" created (world_id: ${r.value.id}).\n\n${stripFrontMatter(guide)}`, { world_id: r.value.id, status: "confirmed" });
      })(),
  );

  server.registerTool(
    "update_world",
    {
      title: "Update world",
      description: "Changes a world's own fields while building it: the as-of moment (interview step 9, where new campaigns start), name, pitch or default approval mode. Only the fields you pass change.",
      inputSchema: {
        world_id: z.string(),
        name: z.string().min(1).optional(),
        pitch: z.string().optional(),
        approval_mode: ApprovalMode.optional(),
        as_of: z.string().optional().describe("the in-story moment; an empty string clears it"),
      },
    },
    (a) =>
      guard(async () => {
        const r = await engine.updateWorld({
          worldId: a.world_id,
          ...(a.name !== undefined && { name: a.name }),
          ...(a.pitch !== undefined && { pitch: a.pitch }),
          ...(a.approval_mode && { approvalMode: a.approval_mode }),
          ...(a.as_of !== undefined && { asOf: a.as_of }),
        });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderWorldUpdated(r.value), { world_id: r.value.id, status: "confirmed" });
      })(),
  );

  server.registerTool(
    "create_entity",
    {
      title: "Create entity",
      description: "Creates a wiki page (character, place, faction, ...). Refused if the name or an alias already names an entity; the match is returned so you can use it instead.",
      inputSchema: {
        world_id: z.string(),
        campaign_id: z.string().optional().describe("set only for a page that exists in one campaign"),
        type: EntityType,
        name: z.string().min(1),
        aliases: z.array(z.string()).default([]),
        source: Source.describe("canon, ruling, invention, or unverified (drafted from an established setting)"),
        summary: z.string().default("").describe("the short current-state block read first"),
        sections: z.array(sectionInput).default([]),
      },
    },
    (a) =>
      guard(async () => {
        const r = await engine.createEntity({
          worldId: a.world_id,
          campaignId: a.campaign_id ?? null,
          type: a.type,
          name: a.name,
          aliases: a.aliases,
          source: a.source,
          summary: a.summary,
          sections: a.sections.map((s) => ({ heading: s.heading, body: s.body, ...(s.key && { key: s.key }), ...(s.visibility && { visibility: s.visibility }) })),
        });
        if (!r.ok) return refused(r.refusal);
        const note =
          r.value.status === "proposed"
            ? `Stored as **proposed** (entity_id: ${r.value.id}): a draft until the user approves it in the web app. Show it to them; revise with edit_entity if they ask.`
            : `Stored as **confirmed** (entity_id: ${r.value.id}).`;
        return reply(md.renderStoredPage(r.value, note), { entity_id: r.value.id, slug: r.value.slug, status: r.value.status });
      })(),
  );

  server.registerTool(
    "edit_entity",
    {
      title: "Edit entity",
      description:
        "Edits a page's summary, sections or source. During play, read the entity this session first (get_context or read_entity). While building a world (no campaign open), pass world_id instead. Sections the user edited are locked: log an update with proposes_section instead.",
      inputSchema: {
        entity: z.string().describe("entity id, slug, name or alias"),
        campaign_id: z.string().optional(),
        world_id: z.string().optional().describe("while building the world, with no campaign open; edits the world page"),
        summary: z.string().optional(),
        source: z.enum(["canon", "invention", "unverified"]).optional().describe("e.g. canon once the user confirms an unverified page"),
        sections: z.array(z.object({ key: kebab, heading: z.string().optional(), body: z.string().optional(), visibility: Visibility.optional() })).default([]),
      },
    },
    (a) =>
      guard(async () => {
        let where: { sessionId: string } | { worldId: string };
        if (a.world_id && !a.campaign_id) where = { worldId: a.world_id };
        else {
          const s = session(a.campaign_id);
          if (!s.ok) return refused(s.refusal);
          where = { sessionId: s.value };
        }
        const r = await engine.editEntity({
          ...where,
          entity: a.entity,
          ...(a.summary !== undefined && { summary: a.summary }),
          ...(a.source && { source: a.source }),
          sections: a.sections,
        });
        if (!r.ok) return refused(r.refusal);
        const note =
          r.value.status === "proposed"
            ? "Stored; the page is **proposed** until the user approves it in the web app (logged in the changelog)."
            : "Stored as **confirmed** (logged in the changelog).";
        return reply(md.renderStoredPage(r.value, note), { entity_id: r.value.id, status: r.value.status });
      })(),
  );

  server.registerTool(
    "import_document",
    {
      title: "Import document",
      description: "Checks your split of an uploaded file against the wiki and reports likely duplicates and disagreements. Nothing is written until confirm_import, so show the user the summary first.",
      inputSchema: {
        world_id: z.string(),
        title: z.string(),
        entities: z.array(
          z.object({ type: EntityType, name: z.string().min(1), aliases: z.array(z.string()).default([]), summary: z.string().default(""), sections: z.array(sectionInput).default([]) }),
        ),
      },
    },
    (a) =>
      guard(async () => {
        const r = await engine.importDocument({
          worldId: a.world_id,
          title: a.title,
          entities: a.entities.map((e) => ({ ...e, sections: e.sections.map((s) => ({ heading: s.heading, body: s.body, ...(s.key && { key: s.key }), ...(s.visibility && { visibility: s.visibility }) })) })),
        });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderImport(r.value), { import_id: r.value.importId, items: r.value.items.length, duplicates: r.value.items.filter((i) => i.duplicateOf).length, status: "pending" });
      })(),
  );

  server.registerTool(
    "confirm_import",
    {
      title: "Confirm import",
      description: "Writes the import items the user accepted, as canon. Pass their indexes from import_document.",
      inputSchema: { import_id: z.string(), accepted: z.array(z.number().int().min(0)) },
    },
    (a) =>
      guard(async () => {
        const r = await engine.confirmImport({ importId: a.import_id, accept: a.accepted });
        if (!r.ok) return refused(r.refusal);
        const lines = [
          `Created ${r.value.created.length} page(s) as **confirmed** canon:`,
          ...r.value.created.map((p) => `- ${p.name} (${p.slug}, entity_id: ${p.id})`),
          ...r.value.refused.map((x) => `- Item ${x.index} **refused**: ${x.refusal.message}`),
        ];
        return reply(lines.join("\n"), { created: r.value.created.map((p) => p.id), refused: r.value.refused.map((x) => x.index), status: "confirmed" });
      })(),
  );

  server.registerTool(
    "create_campaign",
    {
      title: "Create campaign",
      description: "Creates a campaign on a world with the intake answers as settings. Then set_voice_anchor during intake, and open_campaign to play.",
      inputSchema: {
        world_id: z.string(),
        name: z.string().min(1),
        settings: CampaignSettings.default({}),
        approval_mode: ApprovalMode.optional().describe("defaults to the world's"),
        severity_policy: SeverityPolicy.optional().describe("for mixed mode; default minor: autopilot, major: batch"),
      },
    },
    (a) =>
      guard(async () => {
        const r = await engine.createCampaign({
          worldId: a.world_id,
          name: a.name,
          settings: a.settings,
          ...(a.approval_mode && { approvalMode: a.approval_mode }),
          ...(a.severity_policy && { severityPolicy: a.severity_policy }),
        });
        if (!r.ok) return refused(r.refusal);
        return reply(`Campaign "${r.value.name}" created (campaign_id: ${r.value.id}). Approval: ${r.value.approvalMode}.`, { campaign_id: r.value.id, status: "confirmed" });
      })(),
  );

  server.registerTool(
    "set_voice_anchor",
    {
      title: "Set voice anchor",
      description: "Stores the narration voice during intake. After play starts, voice changes go through record_ruling with kind voice.",
      inputSchema: { campaign_id: campaignId, sample: z.string().min(1).describe("verbatim sample"), profile: z.string(), interior_level: z.string(), avoid_list: z.array(z.string()).default([]) },
    },
    (a) =>
      guard(async () => {
        const r = await engine.setVoiceAnchor({ campaignId: a.campaign_id, sample: a.sample, profile: a.profile, interiorLevel: a.interior_level, avoidList: a.avoid_list });
        if (!r.ok) return refused(r.refusal);
        return reply(`Voice anchor stored as **confirmed**.\n\n> ${r.value.sampleVerbatim.replace(/\n/g, "\n> ")}`, { status: "confirmed" });
      })(),
  );

  // ---------------- play ----------------

  server.registerTool(
    "open_campaign",
    {
      title: "Open campaign",
      description: "Must be the first call of every chat. Opens a session and returns settings, voice anchor, PC sheet, threads, rulings, this chapter's scenes, and what the user changed since last session, which overrides your memory of the chat.",
      inputSchema: { campaign_id: campaignId },
    },
    (a) =>
      guard(async () => {
        const r = await engine.openCampaign(a.campaign_id);
        if (!r.ok) return refused(r.refusal);
        sessions.set(a.campaign_id, r.value.session.id);
        const entities = await engine.storage.listEntities(r.value.world.id, { campaignId: a.campaign_id });
        const guide = stripFrontMatter(renderLoadGuide(r.value.world, entities));
        return reply(md.renderOpened(r.value, guide), {
          session_id: r.value.session.id,
          chapter: r.value.campaign.currentChapter,
          changes: r.value.changes.reduce((n, g) => n + g.changes.length, 0),
          unlogged_scene: r.value.unloggedScene ? r.value.unloggedScene.id : null,
        });
      })(),
  );

  server.registerTool(
    "get_context",
    {
      title: "Get context",
      description: "Call before each scene with everyone present, the place and the threads in play. Returns summaries, updates, what each character knows and rulings, ranked by precedence, and marks each entity as read.",
      inputSchema: { campaign_id: campaignId, present: z.array(z.string()).describe("names, aliases or slugs"), place: z.string().optional(), threads: z.array(z.string()).default([]) },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.getContext({ sessionId: s.value, present: a.present, ...(a.place && { place: a.place }) });
        if (!r.ok) return refused(r.refusal);
        let text = md.renderContext(r.value);
        if (a.threads.length) {
          const threads = await engine.storage.listThreads(a.campaign_id);
          const wanted = threads.filter((t) => a.threads.some((q) => q.toLowerCase() === t.title.toLowerCase() || q === t.id));
          if (wanted.length) text = text.replace(/\n---\n## GM ONLY|$/, (m) => `\n\n## Threads in play\n${wanted.map((t) => `- ${t.title} [${t.state}]: ${t.bodyMd}`).join("\n")}${m}`);
        }
        return reply(text, { scene_id: r.value.scene.id, read: r.value.entities.map((e) => e.entity.slug), warnings: r.value.warnings });
      })(),
  );

  server.registerTool(
    "read_entity",
    {
      title: "Read entity",
      description: "Reads a full page and marks it read. Call it the first time a character, place or faction appears this session and wasn't in get_context. Use view player for (OOC) ledger or canon answers.",
      inputSchema: { entity: z.string().describe("entity id, slug, name or alias"), campaign_id: z.string().optional(), view: z.enum(["gm", "player"]).default("gm") },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.readEntity({ sessionId: s.value, ref: a.entity });
        if (!r.ok) return refused(r.refusal);
        const campaign = await engine.sessionCampaign(s.value);
        const pcKnows = new Set<string>();
        if (a.view === "player" && campaign.ok) {
          const pc = await engine.pcEntity(campaign.value);
          if (pc) {
            for (const i of r.value.context.items) if (i.kind === "update" && (await engine.storage.listKnowers("update", i.update.id)).includes(pc.id)) pcKnows.add(i.update.id);
            for (const s of r.value.page.sections) if (s.visibility === "secret" && (await engine.storage.listKnowers("section", s.id)).includes(pc.id)) pcKnows.add(s.id);
          }
        }
        return reply(md.renderEntity(r.value.page, r.value.context, a.view, pcKnows), { entity_id: r.value.page.id, slug: r.value.page.slug, view: a.view });
      })(),
  );

  server.registerTool(
    "search_wiki",
    {
      title: "Search wiki",
      description: "Full-text search over names, aliases, summaries and sections. Returns one line per match. Use view player when answering the player out of character.",
      inputSchema: { query: z.string().min(1), type: EntityType.optional(), campaign_id: z.string().optional(), view: z.enum(["gm", "player"]).default("gm") },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.searchWiki({ sessionId: s.value, query: a.query, view: a.view, ...(a.type && { type: a.type }) });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderSearch(r.value, a.query), { matches: r.value.map((h) => h.entity.slug) });
      })(),
  );

  server.registerTool(
    "log_scene",
    {
      title: "Log scene",
      description: "Call when a scene ends: a summary plus one update per change, inventions included. Tag every entity, set severity, list who knows. Each update is stored or refused on its own; check the statuses.",
      inputSchema: {
        campaign_id: campaignId,
        summary: z.string().min(1),
        present: z.array(z.string()),
        place: z.string().optional(),
        updates: z
          .array(
            z.object({
              entities: z.array(z.string()).default([]),
              tags: z.array(z.string()).default([]).describe("ch-NN time tags or entity names/slugs"),
              type: UpdateType,
              severity: Severity,
              body: z.string().min(1),
              story_time: z.string().optional(),
              supersedes: z.number().int().positive().optional().describe("seq of the update this replaces"),
              knows: z.array(z.string()).default([]).describe("everyone who knows this; include the PC if they do"),
              proposes_section: z.object({ entity: z.string(), key: kebab }).optional().describe("for a change to a section the user locked"),
            }),
          )
          .default([]),
        thread_changes: z
          .array(z.object({ thread: z.string().optional().describe("id or title of an existing thread; omit to open one"), title: z.string().optional(), body: z.string().optional(), state: z.enum(["open", "resolved"]).optional(), tags: z.array(kebab).optional() }))
          .default([]),
        pc_changes: PcSheetData.passthrough().optional().describe("fields to merge into the PC sheet: name, stats, health, stress, inventory, bonds, trackers, flaw_notes"),
        secrets_learned: z
          .array(z.object({ entity: z.string().describe("the page the secret is on"), section: kebab.describe("key of the secret section"), by: z.array(z.string()).min(1).describe("who learned it; include the PC if they did") }))
          .default([])
          .describe("secret sections someone learned this scene; the PC learning one shows it in the player view"),
      },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.logScene({
          sessionId: s.value,
          summary: a.summary,
          present: a.present,
          ...(a.place && { place: a.place }),
          updates: a.updates,
          threadChanges: a.thread_changes,
          ...(a.pc_changes && { pcChanges: a.pc_changes }),
          secretsLearned: a.secrets_learned,
        });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderLogged(r.value), {
          scene_id: r.value.scene.id,
          updates: r.value.results.map((x) => (x.ok ? { seq: x.update.seq, status: x.status } : { status: "refused", rule: x.refusal.rule })),
        });
      })(),
  );

  server.registerTool(
    "close_chapter",
    {
      title: "Close chapter",
      description: "Call at chapter end. Returns a checklist (summaries to refresh, clocks to advance, voice audit); work through it with edit_entity and gm_write.",
      inputSchema: { campaign_id: campaignId, title: z.string().min(1), summary: z.string().min(1) },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.closeChapter({ sessionId: s.value, title: a.title, summary: a.summary });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderChapterClosed(r.value), { chapter: r.value.chapter.number, status: "confirmed", voice_audit_due: r.value.voiceAuditDue });
      })(),
  );

  server.registerTool(
    "update_campaign",
    {
      title: "Update campaign",
      description: "Stores the PC sheet at character creation, the story's as-of moment, or a settings change the user asks for with (OOC) settings. Fields are merged into what is stored. Changes during a scene go in log_scene's pc_changes instead.",
      inputSchema: {
        campaign_id: campaignId,
        settings: CampaignSettings.optional().describe("settings fields to change: genre, tone, difficulty, length, pacing, dice, turn_length, lines, veils"),
        as_of: z.string().optional().describe("the story's current moment, for the era rule"),
        pc_sheet: PcSheetData.passthrough().optional().describe("PC sheet fields to set: name, stats, health, stress, inventory, bonds, trackers, flaw_notes"),
      },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.updateCampaign({
          sessionId: s.value,
          ...(a.settings && { settings: a.settings }),
          ...(a.as_of !== undefined && { asOf: a.as_of }),
          ...(a.pc_sheet && { pcSheet: a.pc_sheet }),
        });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderCampaignUpdated(r.value.campaign, r.value.pcSheet), { campaign_id: r.value.campaign.id, status: "confirmed" });
      })(),
  );

  server.registerTool(
    "record_ruling",
    {
      title: "Record ruling",
      description: "Call when the user makes a ruling in play. Store their words verbatim; rulings take top precedence.",
      inputSchema: { campaign_id: campaignId, text: z.string().min(1).describe("the user's exact words"), kind: z.enum(["canon", "voice", "character_inner_life"]).default("canon") },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.recordRuling({ sessionId: s.value, text: a.text, kind: a.kind });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderRuling(r.value), { ruling_id: r.value.id, status: "confirmed" });
      })(),
  );

  server.registerTool(
    "gm_read",
    { title: "GM read", description: "Reads the hidden story design, clocks, twists and endings. GM only.", inputSchema: { campaign_id: campaignId } },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.gmRead({ sessionId: s.value });
        if (!r.ok) return refused(r.refusal);
        return reply(md.renderGmNotes(r.value), { notes: r.value.length });
      })(),
  );

  server.registerTool(
    "gm_write",
    {
      title: "GM write",
      description: "Creates or replaces a GM note (design, clock, twist, ending, setup, motif). Clocks need data {step, steps, advances_on}; every change is versioned.",
      inputSchema: { campaign_id: campaignId, kind: GmNoteKind, key: kebab, body: z.string(), data: z.record(z.string(), z.unknown()).optional() },
    },
    (a) =>
      guard(async () => {
        const s = session(a.campaign_id);
        if (!s.ok) return refused(s.refusal);
        const r = await engine.gmWrite({ sessionId: s.value, kind: a.kind, key: a.key, body: a.body, ...(a.data && { data: a.data }) });
        if (!r.ok) return refused(r.refusal);
        return reply(`GM note ${r.value.kind}/${r.value.key} stored as **confirmed**.`, { note_id: r.value.id, status: "confirmed" });
      })(),
  );

  return server;
}

function stripFrontMatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "");
}
