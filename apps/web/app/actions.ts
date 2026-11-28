"use server";
/**
 * Server actions. Each one calls RulesEngine (or WebViews) in packages/core and nothing else,
 * so every rule applies to the web app exactly as it does to Claude.
 */
import { isCampaignExport } from "@continuity/core";
import { unzipSync, strFromU8 } from "fflate";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { app, campaignScope, keptCookie, reviewedCookie, WORLD_SPOILERS_COOKIE } from "@/lib/server";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : undefined;
};
const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === undefined) throw new Error(`Missing ${k}.`);
  return v;
};
const editKind = (f: FormData) => {
  const k = str(f, "editKind");
  return k === "retcon" || k === "forward" ? k : undefined;
};
const done = (f: FormData, message = "Saved."): ActionState => {
  revalidatePath(str(f, "path") || "/", "layout");
  return { ok: message, at: Date.now() };
};
const fail = (message: string): ActionState => ({ error: message, at: Date.now() });

// ---------------- spoilers ----------------

export async function setCampaignSpoilers(f: FormData) {
  await (await app()).engine.setSpoilers(req(f, "campaignId"), str(f, "on") === "1");
  revalidatePath("/", "layout");
}

export async function setWorldSpoilers(f: FormData) {
  (await cookies()).set(WORLD_SPOILERS_COOKIE, str(f, "on") === "1" ? "on" : "off", { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

// ---------------- home ----------------

export async function createWorld(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.createWorld({
    name: req(f, "name"),
    pitch: str(f, "pitch") ?? "",
    depth: str(f, "depth") === "full" ? "full" : "compact",
    approvalMode: (str(f, "approvalMode") ?? "batch") as "review" | "batch" | "autopilot" | "mixed",
    author: "user",
  });
  if (!r.ok) return fail(r.refusal.message);
  redirect(`/w/${r.value.id}`);
}

export async function createCampaign(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.createCampaign({ worldId: req(f, "worldId"), name: req(f, "name").trim(), author: "user" });
  if (!r.ok) return fail(r.refusal.message);
  redirect(`/c/${r.value.id}`);
}

/** Import a world or a campaign from a .zip of its Markdown export (the same layout Export produces). */
export async function importWorld(_: ActionState, f: FormData): Promise<ActionState> {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a .zip exported from a world or a campaign.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return fail("That file isn't a readable .zip.");
  }
  const files = new Map(Object.entries(entries).filter(([p]) => p.endsWith(".md")).map(([p, b]) => [p, strFromU8(b)]));
  const { engine } = await app();
  if (isCampaignExport(files)) {
    const c = await engine.importCampaign(files);
    if (!c.ok) return fail(`Nothing was imported: ${c.refusal.message}`);
    redirect(`/c/${c.value.campaign.id}`);
  }
  const r = await engine.importWorld(files);
  if (!r.ok) return fail(`Nothing was imported: ${r.refusal.message}`);
  redirect(`/w/${r.value.id}`);
}

// ---------------- entity page ----------------

export async function editSection(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = editKind(f);
  const r = await (await app()).engine.userEditSection({
    entityId: req(f, "entityId"),
    key: req(f, "key"),
    campaignId: str(f, "campaignId") || null,
    body: req(f, "body"),
    ...(str(f, "heading") && { heading: str(f, "heading") }),
    ...(kind && { editKind: kind }),
    ...(f.has("expected") && { expectedBody: str(f, "expected") }),
  });
  if (!r.ok) return r.refusal.rule === "stale" ? { ...fail(r.refusal.message), stale: true } : fail(r.refusal.message);
  return done(f, `Saved as ${kind === "retcon" ? "a retcon" : "a change from now on"}. The section is now locked against AI edits.`);
}

export async function addSection(_: ActionState, f: FormData): Promise<ActionState> {
  const heading = req(f, "heading").trim();
  if (!heading) return fail("A section needs a heading.");
  const key = heading.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!key || key === "summary") return fail("Pick another heading.");
  const kind = editKind(f);
  const r = await (await app()).engine.userEditSection({
    entityId: req(f, "entityId"),
    key,
    campaignId: str(f, "campaignId") || null,
    heading,
    body: req(f, "body"),
    visibility: str(f, "visibility") === "secret" ? "secret" : "public",
    ...(kind && { editKind: kind }),
  });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Section added.");
}

export async function setSectionVisibility(f: FormData) {
  await (await app()).engine.userEditSection({
    entityId: req(f, "entityId"),
    key: req(f, "key"),
    campaignId: str(f, "campaignId") || null,
    visibility: str(f, "visibility") === "secret" ? "secret" : "public",
  });
  revalidatePath(str(f, "path") || "/", "layout");
}

export async function editSummary(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = editKind(f);
  const r = await (await app()).engine.userEditEntity({
    entityId: req(f, "entityId"),
    patch: { summary: req(f, "body") },
    ...(kind && { editKind: kind }),
    ...(f.has("expected") && { expectedSummary: str(f, "expected") }),
  });
  if (!r.ok) return r.refusal.rule === "stale" ? { ...fail(r.refusal.message), stale: true } : fail(r.refusal.message);
  return done(f, `Summary saved as ${kind === "retcon" ? "a retcon" : "a change from now on"}.`);
}

export async function editAliases(_: ActionState, f: FormData): Promise<ActionState> {
  const aliases = req(f, "aliases")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const r = await (await app()).engine.userEditEntity({ entityId: req(f, "entityId"), patch: { aliases } });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Aliases saved.");
}

/** Upgrade an unverified page once the user has checked it (SPEC Phase 0, path C). */
export async function markCanon(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.userEditEntity({ entityId: req(f, "entityId"), patch: { source: "canon" }, reason: "checked by the user" });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Marked as canon. The GM no longer sees it labeled unverified.");
}

/** Approve or reject a page the GM drafted (it follows the approval mode). */
export async function approvePage(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.approvePage(req(f, "entityId"));
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Approved. ${r.value.name} is canon now.`);
}

/** Approve every drafted page the user saw listed (the ids on the form), so a page that arrives later isn't approved unseen. */
export async function approvePages(_: ActionState, f: FormData): Promise<ActionState> {
  const ids = f.getAll("entityId").filter((v): v is string => typeof v === "string");
  if (!ids.length) return fail("No pages to approve.");
  const { engine } = await app();
  let approved = 0;
  const errors: string[] = [];
  for (const id of ids) {
    const r = await engine.approvePage(id);
    if (r.ok) approved++;
    else errors.push(r.refusal.message);
  }
  if (errors.length) return fail(`Approved ${approved} of ${ids.length}. ${errors[0]}`);
  return done(f, `Approved ${approved} page${approved === 1 ? "" : "s"}. They are canon now.`);
}

export async function rejectPage(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.rejectPage(req(f, "entityId"));
  if (!r.ok) return fail(r.refusal.message);
  const back = str(f, "back");
  if (back) {
    revalidatePath("/", "layout");
    redirect(back);
  }
  return done(f, `Rejected. ${r.value.name} is kept as a record but left out of the wiki and the GM's context.`);
}

export async function setWorldAsOf(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.updateWorld({ worldId: req(f, "worldId"), asOf: str(f, "asOf") ?? "", author: "user" });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, r.value.asOfStoryTime ? "Saved. New campaigns start at this moment." : "Cleared.");
}

export async function restoreVersion(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = editKind(f);
  if (!kind) return fail("Choose retcon or change from now on.");
  const r = await (await app()).engine.restoreVersion(req(f, "versionId"), kind, str(f, "side") === "before" ? "before" : "after");
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Restored. The restore is itself a new version.");
}

// ---------------- review queue ----------------

const YEAR = 60 * 60 * 24 * 365;

/** Keep one GM page edit (UX review #4): its version ids join the campaign's kept list in a browser cookie. */
export async function keepPageChange(_: ActionState, f: FormData): Promise<ActionState> {
  const campaignId = req(f, "campaignId");
  const jar = await cookies();
  const cur = (jar.get(keptCookie(campaignId))?.value ?? "").split(",").filter(Boolean);
  // A cookie holds about 4 KB, so the list keeps the newest 90 ids; Keep all clears it.
  const next = [...new Set([...cur, ...req(f, "versionIds").split(",").filter(Boolean)])].slice(-90);
  jar.set(keptCookie(campaignId), next.join(","), { path: "/", maxAge: YEAR, sameSite: "lax" });
  return done(f, "Kept.");
}

/** Keep every GM page edit shown: "reviewed up to now", and the kept list starts over. */
export async function keepAllPageChanges(_: ActionState, f: FormData): Promise<ActionState> {
  const campaignId = req(f, "campaignId");
  const jar = await cookies();
  jar.set(reviewedCookie(campaignId), new Date().toISOString(), { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.delete(keptCookie(campaignId));
  return done(f, "All kept.");
}

export async function approveUpdate(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.approveUpdate(req(f, "updateId"));
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Update #${r.value.seq} confirmed.`);
}

export async function rejectUpdate(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await (await app()).engine.setUpdateStatus(req(f, "updateId"), "rejected");
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Update #${r.value.seq} rejected. It stays on record.`);
}

export async function editUpdate(_: ActionState, f: FormData): Promise<ActionState> {
  const severity = str(f, "severity");
  const r = await (await app()).engine.userEditUpdate(req(f, "updateId"), {
    body: req(f, "body"),
    ...((severity === "minor" || severity === "major") && { severity }),
  });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Update #${r.value.seq} edited. It is still proposed.`);
}

export async function approveAllMinor(_: ActionState, f: FormData): Promise<ActionState> {
  const scope = await campaignScope(req(f, "campaignId"));
  const approved = await (await app()).views.approveVisibleMinor(scope);
  return done(f, approved.length ? `Approved ${approved.length} minor update${approved.length === 1 ? "" : "s"}.` : "No minor updates to approve.");
}

// ---------------- campaign dashboard ----------------

export async function editVoiceAnchor(_: ActionState, f: FormData): Promise<ActionState> {
  const avoid = str(f, "avoidList");
  const r = await (await app()).engine.editVoiceAnchor({
    campaignId: req(f, "campaignId"),
    sample: req(f, "sample"),
    ...(str(f, "profile") !== undefined && { profile: str(f, "profile") }),
    ...(str(f, "interiorLevel") !== undefined && { interiorLevel: str(f, "interiorLevel") }),
    ...(avoid !== undefined && { avoidList: avoid.split("\n") }),
  });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Voice saved. The GM checks every scene against it from the next one.");
}

export async function setApprovalMode(_: ActionState, f: FormData): Promise<ActionState> {
  const mode = req(f, "mode") as "review" | "batch" | "autopilot" | "mixed";
  const minor = str(f, "minor") as "review" | "batch" | "autopilot" | undefined;
  const major = str(f, "major") as "review" | "batch" | "autopilot" | undefined;
  const r = await (await app()).engine.setApprovalMode(req(f, "campaignId"), mode, minor && major ? { minor, major } : undefined);
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Approval mode saved.");
}

// ---------------- new page ----------------

const TYPES = ["character", "place", "faction", "item", "event", "concept", "rule"] as const;
const SOURCES = ["canon", "invention", "unverified"] as const;

/** A page the user writes by hand (UX review #5): confirmed at once, then opened so they can fill in its sections. */
export async function createPage(_: ActionState, f: FormData): Promise<ActionState> {
  const type = TYPES.find((t) => t === str(f, "type"));
  if (!type) return fail("Choose what kind of page this is.");
  const name = req(f, "name").trim();
  if (!name) return fail("Give the page a name.");
  const campaignId = str(f, "campaignId") || null;
  const r = await (await app()).engine.userCreateEntity({
    worldId: req(f, "worldId"),
    campaignId,
    type,
    name,
    aliases: (str(f, "aliases") ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    source: SOURCES.find((s) => s === str(f, "source")) ?? "canon",
    summary: (str(f, "summary") ?? "").trim(),
  });
  if (!r.ok) {
    if (r.refusal.rule === "duplicate" && r.refusal.ref) {
      const res = await (await app()).engine.storage.resolveEntity(req(f, "worldId"), r.refusal.ref, { campaignId });
      const other = res.status === "resolved" ? res.entity.name : r.refusal.ref;
      const taken = r.refusal.message.match(/^"([^"]+)"/)?.[1] ?? name;
      return fail(`“${taken}” is already used by ${other}. Open that page and add to it, or pick another name.`);
    }
    return fail(r.refusal.message);
  }
  revalidatePath("/", "layout");
  redirect(`${req(f, "base")}/e/${r.value.slug}`);
}
