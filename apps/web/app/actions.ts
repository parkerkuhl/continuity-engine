"use server";
/**
 * Server actions. Each one calls RulesEngine (or WebViews) in packages/core and nothing else,
 * so every rule applies to the web app exactly as it does to Claude.
 */
import { unzipSync, strFromU8 } from "fflate";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { app, campaignScope, WORLD_SPOILERS_COOKIE } from "@/lib/server";
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
  await app().engine.setSpoilers(req(f, "campaignId"), str(f, "on") === "1");
  revalidatePath("/", "layout");
}

export async function setWorldSpoilers(f: FormData) {
  (await cookies()).set(WORLD_SPOILERS_COOKIE, str(f, "on") === "1" ? "on" : "off", { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

// ---------------- home ----------------

export async function createWorld(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await app().engine.createWorld({
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
  const r = await app().engine.createCampaign({ worldId: req(f, "worldId"), name: req(f, "name").trim(), author: "user" });
  if (!r.ok) return fail(r.refusal.message);
  redirect(`/c/${r.value.id}`);
}

/** Import a world from a .zip of its Markdown export (the same layout Export produces). */
export async function importWorld(_: ActionState, f: FormData): Promise<ActionState> {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a .zip exported from a world.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return fail("That file isn't a readable .zip.");
  }
  const files = new Map(Object.entries(entries).filter(([p]) => p.endsWith(".md")).map(([p, b]) => [p, strFromU8(b)]));
  const r = await app().engine.importWorld(files);
  if (!r.ok) return fail(`Nothing was imported: ${r.refusal.message}`);
  redirect(`/w/${r.value.id}`);
}

// ---------------- entity page ----------------

export async function editSection(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = editKind(f);
  const r = await app().engine.userEditSection({
    entityId: req(f, "entityId"),
    key: req(f, "key"),
    campaignId: str(f, "campaignId") || null,
    body: req(f, "body"),
    ...(str(f, "heading") && { heading: str(f, "heading") }),
    ...(kind && { editKind: kind }),
  });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Saved as ${kind === "retcon" ? "a retcon" : "a change from now on"}. The section is now locked against AI edits.`);
}

export async function addSection(_: ActionState, f: FormData): Promise<ActionState> {
  const heading = req(f, "heading").trim();
  if (!heading) return fail("A section needs a heading.");
  const key = heading.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!key || key === "summary") return fail("Pick another heading.");
  const kind = editKind(f);
  const r = await app().engine.userEditSection({
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
  await app().engine.userEditSection({
    entityId: req(f, "entityId"),
    key: req(f, "key"),
    campaignId: str(f, "campaignId") || null,
    visibility: str(f, "visibility") === "secret" ? "secret" : "public",
  });
  revalidatePath(str(f, "path") || "/", "layout");
}

export async function editSummary(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = editKind(f);
  const r = await app().engine.userEditEntity({ entityId: req(f, "entityId"), patch: { summary: req(f, "body") }, ...(kind && { editKind: kind }) });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Summary saved as ${kind === "retcon" ? "a retcon" : "a change from now on"}.`);
}

export async function editAliases(_: ActionState, f: FormData): Promise<ActionState> {
  const aliases = req(f, "aliases")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const r = await app().engine.userEditEntity({ entityId: req(f, "entityId"), patch: { aliases } });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Aliases saved.");
}

/** Upgrade an unverified page once the user has checked it (SPEC Phase 0, path C). */
export async function markCanon(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await app().engine.userEditEntity({ entityId: req(f, "entityId"), patch: { source: "canon" }, reason: "checked by the user" });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Marked as canon. The GM no longer sees it labeled unverified.");
}

export async function restoreVersion(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = editKind(f);
  if (!kind) return fail("Choose retcon or change from now on.");
  const r = await app().engine.restoreVersion(req(f, "versionId"), kind, str(f, "side") === "before" ? "before" : "after");
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Restored. The restore is itself a new version.");
}

// ---------------- review queue ----------------

export async function approveUpdate(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await app().engine.approveUpdate(req(f, "updateId"));
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Update #${r.value.seq} confirmed.`);
}

export async function rejectUpdate(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await app().engine.setUpdateStatus(req(f, "updateId"), "rejected");
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Update #${r.value.seq} rejected. It stays on record.`);
}

export async function editUpdate(_: ActionState, f: FormData): Promise<ActionState> {
  const severity = str(f, "severity");
  const r = await app().engine.userEditUpdate(req(f, "updateId"), {
    body: req(f, "body"),
    ...((severity === "minor" || severity === "major") && { severity }),
  });
  if (!r.ok) return fail(r.refusal.message);
  return done(f, `Update #${r.value.seq} edited. It is still proposed.`);
}

export async function approveAllMinor(_: ActionState, f: FormData): Promise<ActionState> {
  const scope = await campaignScope(req(f, "campaignId"));
  const approved = await app().views.approveVisibleMinor(scope);
  return done(f, approved.length ? `Approved ${approved.length} minor update${approved.length === 1 ? "" : "s"}.` : "No minor updates to approve.");
}

// ---------------- campaign dashboard ----------------

export async function setApprovalMode(_: ActionState, f: FormData): Promise<ActionState> {
  const mode = req(f, "mode") as "review" | "batch" | "autopilot" | "mixed";
  const minor = str(f, "minor") as "review" | "batch" | "autopilot" | undefined;
  const major = str(f, "major") as "review" | "batch" | "autopilot" | undefined;
  const r = await app().engine.setApprovalMode(req(f, "campaignId"), mode, minor && major ? { minor, major } : undefined);
  if (!r.ok) return fail(r.refusal.message);
  return done(f, "Approval mode saved.");
}
