import Link from "next/link";
import type { UpdateView } from "@continuity/core";
import { approveUpdate, editUpdate, rejectUpdate } from "@/app/actions";
import { ActionForm } from "./action-form";

const STATUS: Record<string, [string, string]> = {
  proposed: ["Proposed", "bg-pending text-[#1c1e21]"],
  confirmed: ["Confirmed", "bg-ok-soft text-ok"],
  rejected: ["Rejected", "bg-sunken text-muted"],
  retconned: ["Retconned", "bg-sunken text-muted"],
  superseded: ["Superseded", "bg-sunken text-muted"],
};

export function StatusPill({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-sunken text-muted"];
  return <span className={`pill px-2 ${cls}`}>{label}</span>;
}

export function Severity({ severity }: { severity: string }) {
  return severity === "major" ? <span className="font-semibold text-warn">Major</span> : <span className="font-semibold text-muted">Minor</span>;
}

const TAG: Record<string, string> = {
  character: "bg-tag-character-soft text-tag-character",
  place: "bg-tag-place-soft text-tag-place",
  faction: "bg-tag-faction-soft text-tag-faction",
  item: "bg-tag-thing-soft text-tag-thing",
  event: "bg-tag-thing-soft text-tag-thing",
  time: "border border-tag-chapter-line bg-surface text-body py-0 px-[5px]",
};

/** Tags colored by what they name: character, place, faction, item or event, chapter, other. */
export function TagChips({ tags }: { tags: UpdateView["tagTypes"] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t.tag} className={`rounded-[5px] px-1.5 py-px text-[11.5px] ${TAG[t.type] ?? "bg-sunken text-body"}`}>
          #{t.tag}
        </span>
      ))}
    </div>
  );
}

export const chapterTag = (n: number | null) => (n === null ? null : `ch-${String(n).padStart(2, "0")}`);
const typeText = (t: string) => t.replace(/-/g, " ");

/** The line over an update: number, status, severity, type and chapter, and the pages it touches. */
export function UpdateMeta({ v, base, status = true }: { v: UpdateView; base: string; status?: boolean }) {
  const u = v.update;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <b className="text-sm">#{u.seq}</b>
      {status && <StatusPill status={u.status} />}
      <Severity severity={u.severity} />
      <span className="text-faint">
        {typeText(u.type)}
        {u.chapter !== null && <> · {chapterTag(u.chapter)}</>}
      </span>
      {v.entities.map((e) => (
        <Link key={e.id} href={`${base}/e/${e.slug}`} className="rounded-full bg-accent-soft px-2 py-px text-accent-ink hover:text-accent">
          {e.name}
        </Link>
      ))}
    </div>
  );
}

export function Knows({ v }: { v: UpdateView }) {
  if (!v.knows.length) return null;
  return <div className="text-xs text-muted">Knows: {v.knows.map((e) => e.name).join(", ")}</div>;
}

/** Approve and Reject buttons for a proposed update, as server-action forms. */
export function ApproveButton({ v, path, label = "Approve" }: { v: UpdateView; path: string; label?: string }) {
  return (
    <ActionForm action={approveUpdate}>
      <input type="hidden" name="updateId" value={v.update.id} />
      <input type="hidden" name="path" value={path} />
      <button className="btn-primary btn-sm">{label}</button>
    </ActionForm>
  );
}

export function RejectButton({ v, path, label = "Reject", primary }: { v: UpdateView; path: string; label?: string; primary?: boolean }) {
  return (
    <ActionForm action={rejectUpdate}>
      <input type="hidden" name="updateId" value={v.update.id} />
      <input type="hidden" name="path" value={path} />
      <button className={primary ? "btn-primary btn-sm" : "btn-danger btn-sm"}>{label}</button>
    </ActionForm>
  );
}

export const editProps = (v: UpdateView, path: string) => ({
  action: editUpdate,
  hidden: { updateId: v.update.id, path },
  seq: v.update.seq,
  severity: v.update.severity,
});
