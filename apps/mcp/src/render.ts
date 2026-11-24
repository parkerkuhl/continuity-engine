/**
 * Compact Markdown for Claude. Secret material (secret sections, GM notes) always goes in one final
 * `GM ONLY` block so it is easy not to read out (SPEC "Spoiler model").
 */
import type {
  CampaignOpened,
  ChangeGroup,
  ChapterClosed,
  ContextItem,
  Entity,
  EntityContext,
  EntityPage,
  GmNote,
  ImportReport,
  Refusal,
  Ruling,
  SceneContext,
  SceneLogged,
  Update,
  Version,
  World,
  Campaign,
  PcSheet,
} from "@continuity/core";

export const GM_ONLY = "## GM ONLY (secrets: don't show the player unless spoilers are on and they ask)";

const sceneTag = (chapter: number, number: number) => `ch-${String(chapter).padStart(2, "0")}-s${number}`;

export function refusalText(r: Refusal): string {
  const lines = [`**Refused (${r.rule}).** ${r.message}`];
  if (r.suggestions?.length) lines.push(`Closest matches: ${r.suggestions.join(", ")}`);
  return lines.join("\n");
}

function mode(c: Campaign): string {
  return c.approvalMode === "mixed" ? `mixed (minor: ${c.severityPolicy.minor}, major: ${c.severityPolicy.major})` : c.approvalMode;
}

function updateLine(u: Update, label?: string | null): string {
  const status = label ? ` **${label}**` : ` [${u.status}]`;
  const meta = [u.type, u.severity, u.storyTime].filter(Boolean).join(", ");
  return `- #${u.seq}${status} (${meta}) ${u.bodyMd.replace(/\n+/g, " ")}`;
}

function changeLine(v: Version): string {
  const kind =
    v.editKind === "retcon"
      ? "RETCON: this was always so; don't explain it"
      : v.editKind === "forward"
        ? "FORWARD: this changed in the story; account for it if it matters"
        : "edit";
  const after = v.after as Record<string, unknown> | null;
  let what = v.objectType as string;
  let text = "";
  if (v.objectType === "section" && after) {
    what = `section "${after.heading}"`;
    text = String(after.bodyMd ?? "");
  } else if (v.objectType === "entity" && after) {
    const before = (v.before ?? {}) as Record<string, unknown>;
    const fields = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]) && k !== "sections");
    what = `page fields (${fields.join(", ") || "created"})`;
    text = fields.map((f) => `${f}: ${JSON.stringify(after[f])}`).join("; ");
  } else if (v.objectType === "update" && after) {
    what = `update #${after.seq} is now ${after.status}`;
  } else if (v.objectType === "ruling" && after) {
    what = "ruling";
    text = `"${after.text}"`;
  } else if (v.objectType === "voice_anchor" && after) {
    const before = (v.before ?? {}) as Record<string, unknown>;
    const fields = ["sampleVerbatim", "profileMd", "interiorLevel", "avoidList"].filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    what = "voice anchor (write against the new version from the next turn)";
    text = fields.map((f) => `${f}: ${Array.isArray(after[f]) ? (after[f] as string[]).join("; ") : String(after[f])}`).join("\n");
  }
  return `- ${what} [${kind}]${text ? `\n  > ${text.replace(/\n/g, "\n  > ")}` : ""}`;
}

function changeFeed(groups: ChangeGroup[]): string[] {
  if (!groups.length) return ["Nothing changed since the last session."];
  const out = ["The user changed these since the last session. They override anything you remember from chat."];
  for (const g of groups) {
    out.push(`### ${g.entity ? `${g.entity.name} (${g.entity.slug})` : g.label}`);
    for (const v of g.changes) out.push(changeLine(v));
  }
  return out;
}

export function renderOpened(o: CampaignOpened, guide: string): string {
  const c = o.campaign;
  const lines = [
    `# ${c.name} (world: ${o.world.name})`,
    `Session open. Chapter ${c.currentChapter}. Approval: ${mode(c)}. Spoilers: ${c.spoilersOn ? "on" : "off"}.`,
  ];
  if (o.warnings.length) lines.push("", ...o.warnings.map((w) => `> ⚠ ${w}`));
  lines.push("", "## Changed since last session", ...changeFeed(o.changes));
  const settings = Object.entries(c.settings).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join("; ") : v}`);
  if (c.asOfStoryTime) settings.unshift(`- as of: ${c.asOfStoryTime}`);
  if (settings.length) lines.push("", "## Settings", ...settings);
  if (o.voiceAnchor) {
    const a = o.voiceAnchor;
    lines.push("", "## Voice anchor", `Interior level: ${a.interiorLevel}`, a.profileMd, "", "Sample:", `> ${a.sampleVerbatim.replace(/\n/g, "\n> ")}`);
    if (a.avoidList.length) lines.push(`Avoid: ${a.avoidList.join("; ")}`);
    if (a.voiceRulings.length) lines.push("Voice rulings:", ...a.voiceRulings.map((r) => `- "${r}"`));
  }
  if (o.pcSheet) lines.push("", "## PC sheet", "```json", JSON.stringify(o.pcSheet.data, null, 2), "```");
  lines.push("", "## Open threads", ...(o.openThreads.length ? o.openThreads.map((t) => `- ${t.title}${t.bodyMd ? `: ${t.bodyMd}` : ""}`) : ["None."]));
  if (o.chapters.length) lines.push("", "## Chapters", ...o.chapters.map((ch) => `- ch-${String(ch.number).padStart(2, "0")} ${ch.title}: ${ch.summaryMd}`));
  if (o.chapterScenes.length)
    lines.push("", `## This chapter so far (ch-${String(c.currentChapter).padStart(2, "0")})`, ...o.chapterScenes.map((sc) => `- Scene ${sc.number}: ${sc.summaryMd}`));
  if (o.missingToPc.length)
    lines.push(
      "",
      `## Characters with no "To the PC" line`,
      `Before play, give each a short line saying who they are to the PC (e.g. "Older brother"), from what their page says: \`edit_entity\` with section key \`to-the-pc\`, after reading them.`,
      ...o.missingToPc.map((e) => `- ${e.name} (${e.slug})`),
    );
  lines.push("", "## Rulings", ...(o.rulings.length ? o.rulings.map((r) => `- "${r.text}"${r.origin === "user_edit" ? " (from a page edit)" : ""}`) : ["None yet."]));
  lines.push("", "## Pinned: load guide", guide.replace(/^(#+) /gm, "#$1 "));
  return lines.join("\n");
}

function itemText(i: ContextItem): string {
  const label = i.label ? `**${i.label}** ` : "";
  if (i.kind === "summary") return `${label}${i.text}`;
  if (i.kind === "section") {
    const src = i.rank === 1 ? " [user edit]" : i.layer === "campaign" ? " [campaign]" : "";
    return `### ${i.section.heading}${src}\n${label}${i.section.bodyMd}`;
  }
  return updateLine(i.update, i.label);
}

/** One entity's context. Secret items are returned separately for the GM ONLY block. */
function entityBlock(ctx: EntityContext): { open: string; secret: string[] } {
  const e = ctx.entity;
  const open = [
    `## ${e.name} (${e.type}, ${e.slug})${e.aliases.length ? ` aka ${e.aliases.join(", ")}` : ""}${
      e.source === "unverified" ? " — UNVERIFIED page: drafted from an established setting, not yet checked; don't treat it as settled canon" : ""
    }${e.status === "proposed" ? " — PROPOSED page: drafted by the GM, not yet approved by the user" : ""}`,
  ];
  const secret: string[] = [];
  const updates: string[] = [];
  for (const i of ctx.items) {
    if (i.secret && i.kind === "update") secret.push(`### ${e.name}: update the PC doesn't know\n${itemText(i)}`);
    else if (i.secret) secret.push(`### ${e.name}: ${i.kind === "section" ? i.section.heading : "secret"}\n${i.kind === "section" ? i.section.bodyMd : ""}`);
    else if (i.kind === "update") updates.push(itemText(i));
    else open.push(itemText(i));
  }
  if (updates.length) open.push("### Updates", ...updates);
  const knowsOpen = ctx.knows.filter((u) => !ctx.secretUpdateIds.has(u.id));
  const knowsSecret = ctx.knows.filter((u) => ctx.secretUpdateIds.has(u.id));
  if (knowsOpen.length) open.push(`### Knows`, ...knowsOpen.map((u) => updateLine(u)));
  if (knowsSecret.length) secret.push(`### ${e.name} knows (the PC doesn't)`, ...knowsSecret.map((u) => updateLine(u)));
  return { open: open.join("\n"), secret };
}

export function renderContext(c: SceneContext): string {
  const lines = [`# Scene context (${sceneTag(c.scene.chapter, c.scene.number)})`];
  if (c.warnings.length) lines.push(...c.warnings.map((w) => `> ⚠ ${w}`));
  if (c.rulings.length) lines.push("", "## Rulings (top precedence)", ...c.rulings.map((r) => `- "${r.text}"`));
  if (c.voiceAnchor) {
    const a = c.voiceAnchor;
    lines.push("", "## Voice (check this scene's prose against the sample)", `> ${a.sampleVerbatim.replace(/\n/g, "\n> ")}`, `Interior level: ${a.interiorLevel}`);
    if (a.avoidList.length) lines.push(`Avoid: ${a.avoidList.join("; ")}`);
    if (a.voiceRulings.length) lines.push("Voice rulings:", ...a.voiceRulings.map((r) => `- "${r}"`));
  }
  const secret: string[] = [];
  for (const e of c.entities) {
    const b = entityBlock(e);
    lines.push("", b.open);
    secret.push(...b.secret);
  }
  if (secret.length) lines.push("", "---", GM_ONLY, ...secret);
  return lines.join("\n");
}

export function renderEntity(page: EntityPage, ctx: EntityContext, view: "gm" | "player", pcKnows: Set<string>): string {
  if (view === "player") {
    const lines = [`# ${page.name} (${page.type})`];
    if (page.summary) lines.push(page.summary);
    for (const s of page.sections.filter((s) => s.visibility === "public" || pcKnows.has(s.id))) lines.push("", `## ${s.heading}`, s.bodyMd);
    const known = ctx.items.filter((i): i is Extract<ContextItem, { kind: "update" }> => i.kind === "update" && pcKnows.has(i.update.id));
    if (known.length) lines.push("", "## What the character knows", ...known.map((i) => updateLine(i.update, i.label)));
    lines.push("", "_Player view: secrets and things the character doesn't know are left out._");
    return lines.join("\n");
  }
  const b = entityBlock(ctx);
  return [b.open, ...(b.secret.length ? ["", "---", GM_ONLY, ...b.secret] : [])].join("\n");
}

export function renderStoredPage(p: EntityPage, note: string): string {
  const lines = [`${note}`, `# ${p.name} (${p.type}, ${p.slug}, source: ${p.source}${p.status === "proposed" ? ", proposed" : ""})`];
  if (p.aliases.length) lines.push(`Aliases: ${p.aliases.join(", ")}`);
  if (p.summary) lines.push("", p.summary);
  const secret: string[] = [];
  for (const s of p.sections) {
    const head = `## ${s.heading}${s.lockedByUser ? " [locked by user]" : ""}${s.campaignId ? " [campaign]" : ""}`;
    if (s.visibility === "secret") secret.push(`### ${s.heading}\n${s.bodyMd}`);
    else lines.push("", head, s.bodyMd);
  }
  if (secret.length) lines.push("", "---", GM_ONLY, ...secret);
  return lines.join("\n");
}

export function renderLogged(r: SceneLogged): string {
  const lines = [`# Scene ${sceneTag(r.scene.chapter, r.scene.number)} logged`];
  const stored = r.results.filter((x) => x.ok);
  const refused = r.results.filter((x) => !x.ok);
  lines.push(`${stored.length} update(s) stored, ${refused.length} refused.`);
  for (const x of r.results) {
    if (x.ok) {
      const notes = [x.forcedMajor ? "severity forced to major" : "", x.update.conflictsWith ? "parked as a conflict for the user to review" : ""].filter(Boolean);
      lines.push(`- Update ${x.index + 1} → #${x.update.seq} stored as **${x.status}**${notes.length ? ` (${notes.join("; ")})` : ""}. Tags: ${Object.entries(x.tagTypes).map(([t, k]) => `${t} (${k})`).join(", ") || "none"}`);
    } else {
      lines.push(`- Update ${x.index + 1} **refused (${x.refusal.rule})**: ${x.refusal.message}`);
    }
  }
  if (refused.length) lines.push("", "Fix the refused updates and log them again with log_scene; the stored ones are kept.");
  if (stored.some((x) => x.ok && x.status === "proposed")) lines.push("Proposed updates are soft canon until the user approves them.");
  if (r.threads.length) lines.push("", "Threads:", ...r.threads.map((t) => `- ${t.title} [${t.state}]`));
  if (r.secretsLearned.length) {
    lines.push("", "Secrets learned:", ...r.secretsLearned.map((x) => `- "${x.section.heading}" of ${x.entity.name}: now known by ${x.knowers.map((k) => k.name).join(", ")}`));
  }
  if (r.voiceAuditDue) lines.push("", "Voice audit due: before the next turn, compare the last few turns against the voice sample and the avoid list, and correct any drift silently.");
  return lines.join("\n");
}

export function renderWorlds(rows: { world: World; campaigns: Campaign[] }[]): string {
  if (!rows.length) return "No worlds yet. Create one with create_world.";
  return rows
    .map(({ world, campaigns }) =>
      [
        `## ${world.name} (world_id: ${world.id})`,
        world.pitch,
        `Depth: ${world.depth}. Default approval: ${world.defaultApprovalMode}.${world.asOfStoryTime ? ` As of: ${world.asOfStoryTime}.` : ""}`,
        ...(campaigns.length ? campaigns.map((c) => `- Campaign "${c.name}" (campaign_id: ${c.id}), chapter ${c.currentChapter}`) : ["- No campaigns."]),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function renderWorldUpdated(w: World): string {
  return [
    `World "${w.name}" updated (world_id: ${w.id}).`,
    w.pitch && `Pitch: ${w.pitch}`,
    `Default approval: ${w.defaultApprovalMode}.`,
    `As of: ${w.asOfStoryTime ?? "not set"}. New campaigns start here.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderSearch(hits: { entity: Entity; line: string }[], query: string): string {
  if (!hits.length) return `No matches for "${query}".`;
  return [`# Matches for "${query}"`, ...hits.map((h) => `- ${h.entity.name} (${h.entity.type}, ${h.entity.slug}): ${h.line}`)].join("\n");
}

export function renderImport(r: ImportReport): string {
  const lines = [`# Import "${r.title}" (import_id: ${r.importId})`, "Nothing is written until confirm_import. Show the user this summary first."];
  for (const i of r.items) {
    lines.push(`- [${i.index}] ${i.name} (${i.type})${i.duplicateOf ? ` — likely duplicate of **${i.duplicateOf}**` : " — new"}`);
    for (const d of i.disagreements) lines.push(`  - disagrees on ${d.field}: wiki says "${d.existing}", file says "${d.incoming}"`);
    if (i.newAliases.length) lines.push(`  - adds aliases the wiki lacks: ${i.newAliases.join(", ")}`);
    for (const o of i.alsoIn) {
      const where = o.importId === r.importId ? `item [${o.index}] of this file` : `item [${o.index}] of pending import "${o.title}" (${o.importId})`;
      lines.push(`  - also in ${where} as ${o.name}; confirm only one of them`);
      for (const d of o.disagreements) lines.push(`    - the files disagree on ${d.field}: "${d.existing}" vs "${d.incoming}"`);
    }
  }
  return lines.join("\n");
}

export function renderChapterClosed(r: ChapterClosed): string {
  const lines = [`# Chapter ${r.chapter.number} closed: ${r.chapter.title}`, "Work through this checklist now:"];
  lines.push(
    "",
    "## Refresh these summaries (edit_entity)",
    ...(r.refreshSummaries.length ? r.refreshSummaries.map((x) => `- [ ] ${x.entity.slug} (${x.updates} update(s) this chapter)`) : ["- Nothing changed."]),
  );
  lines.push(
    "",
    "## Advance clocks if they moved (gm_write)",
    ...(r.clocks.length ? r.clocks.map((c) => `- [ ] ${c.key}: step ${(c.data as { step?: number } | null)?.step ?? "?"}/${(c.data as { steps?: number } | null)?.steps ?? "?"}`) : ["- No clocks."]),
  );
  lines.push("", "## Voice audit", r.voiceAuditDue ? `- [ ] Due (${r.scenesSinceAudit} scenes since the last one).` : "- Not due.");
  return lines.join("\n");
}

export function renderGmNotes(notes: GmNote[]): string {
  const lines = [GM_ONLY];
  if (!notes.length) lines.push("No GM notes yet.");
  for (const n of notes) {
    lines.push(`### ${n.kind}: ${n.key}`, n.bodyMd);
    if (n.data) lines.push("```json", JSON.stringify(n.data), "```");
  }
  return lines.join("\n");
}

export function renderRuling(r: Ruling): string {
  return `Ruling stored verbatim (top precedence):\n> ${r.text}`;
}

export function renderCampaignUpdated(c: Campaign, pcSheet: PcSheet | null): string {
  const lines = [`Campaign "${c.name}" updated (confirmed).`];
  const settings = Object.entries(c.settings).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join("; ") : v}`);
  if (c.asOfStoryTime) settings.unshift(`- as of: ${c.asOfStoryTime}`);
  if (settings.length) lines.push("", "## Settings", ...settings);
  if (pcSheet) lines.push("", "## PC sheet", "```json", JSON.stringify(pcSheet.data, null, 2), "```");
  return lines.join("\n");
}
