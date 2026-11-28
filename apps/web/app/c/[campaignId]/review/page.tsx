import Link from "next/link";
import { approveAllMinor, approveScene } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { ApproveButton, Knows, RejectButton, Severity, TagChips, UpdateMeta, chapterTag, editProps, extraTags } from "@/components/update-card";
import { PageChanges } from "@/components/page-changes";
import { PageQueue } from "@/components/page-queue";
import { UpdateItem } from "@/components/update-item";
import { app, campaignScope, pageChanges, scopeTitle, reviewQueue, pageQueue, dashboard } from "@/lib/server";
import { sceneLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ campaignId: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const n = ((await dashboard(scope))?.reviewCount ?? 0) + (await pageChanges(scope)).length;
  return scopeTitle(scope, n ? `Review (${n})` : "Review");
}

const MODE: Record<string, [string, string]> = {
  review: ["Review everything", "Nothing counts until you approve it."],
  batch: ["Batch review", "The GM is already using them as soft canon until you decide."],
  autopilot: ["Autopilot", "Only conflicts wait here; everything else went straight to canon."],
  mixed: ["Mixed by severity", "Each update follows the rule for its severity."],
};
const FILTERS = ["all", "conflicts", "major", "minor", "changes", "pages"] as const;

export default async function Review({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { campaignId } = await params;
  const f = (FILTERS as readonly string[]).includes((await searchParams).filter ?? "") ? (await searchParams).filter! : "all";
  const scope = await campaignScope(campaignId);
  const [{ items }, pages, changes] = await Promise.all([reviewQueue(scope), pageQueue(scope), pageChanges(scope)]);
  const base = `/c/${campaignId}`;
  const path = `${base}/review`;
  const c = scope.campaign!;
  const conflicts = items.filter((i) => i.update.conflictsWith);
  const rest = items.filter((i) => !i.update.conflictsWith);
  const minor = rest.filter((i) => i.update.severity === "minor").length;
  const counts = { all: items.length + changes.length + pages.length, pages: pages.length, changes: changes.length, conflicts: conflicts.length, major: items.filter((i) => i.update.severity === "major").length, minor: items.filter((i) => i.update.severity === "minor").length };
  const keep = (i: (typeof items)[number]) => f === "all" || (f === "conflicts" ? !!i.update.conflictsWith : i.update.severity === f);
  const showPages = f === "all" || f === "pages";
  const showChanges = f === "all" || f === "changes";
  const [modeName, modeNote] = MODE[c.approvalMode] ?? ["", ""];
  const n = items.length + changes.length;
  // UX review #22/#23: updates grouped under the scene they came from, newest scene first.
  const groups = new Map<string, { scene: (typeof items)[number]["scene"]; rows: typeof items }>();
  for (const v of rest.filter(keep)) {
    const k = v.scene?.id ?? "";
    if (!groups.has(k)) groups.set(k, { scene: v.scene ?? null, rows: [] });
    groups.get(k)!.rows.push(v);
  }
  const sceneGroups = [...groups.values()].sort((a, b) =>
    !a.scene ? 1 : !b.scene ? -1 : b.scene.chapter - a.scene.chapter || b.scene.number - a.scene.number,
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Review queue</h1>
          <p className="mt-1.5 text-muted">
            {n === 0 && pages.length === 0
              ? "Nothing waiting."
              : `${n + pages.length} waiting: ` +
                [conflicts.length > 0 && `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`, rest.length > 0 && `${rest.length} update${rest.length === 1 ? "" : "s"}`, changes.length > 0 && `${changes.length} page change${changes.length === 1 ? "" : "s"}`, pages.length > 0 && `${pages.length} new page${pages.length === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(", ") +
                "."}{" "}
            Mode: <b className="text-ink">{modeName}</b>. {modeNote}
          </p>
        </div>
        <ActionForm action={approveAllMinor}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="path" value={path} />
          {minor > 0 && <button className="btn-primary">Approve all minor ({minor})</button>}
        </ActionForm>
      </div>

      <div role="group" aria-label="Filter" className="-mt-1 flex flex-wrap gap-2">
        {FILTERS.map((k) => {
          const label = { all: "All", conflicts: "Conflicts", major: "Major updates", minor: "Minor updates", changes: "Page changes", pages: "New pages" }[k];
          const on = f === k;
          const cls = on ? "chip-on" : k === "conflicts" && counts.conflicts ? "chip border-danger-border font-semibold text-danger" : "chip";
          return (
            <Link key={k} href={k === "all" ? path : `${path}?filter=${k}`} aria-pressed={on} className={cls}>
              {label} {counts[k]}
            </Link>
          );
        })}
      </div>

      {conflicts.filter(keep).map((v) => (
        <section key={v.update.id} aria-label={`Conflict #${v.update.seq}`} className="flex flex-col gap-3.5 rounded-xl border-2 border-danger-line bg-surface px-6 py-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <b className="text-sm">#{v.update.seq}</b>
            <span className="pill bg-danger-soft font-bold text-danger">{v.update.conflictsWith!.type === "section" ? "Conflicts with your locked section" : "Conflicts with canon"}</span>
            <span className="font-semibold text-warn">
              <Severity severity={v.update.severity} /> · {v.update.type.replace(/-/g, " ")}
            </span>
            <span className="text-faint">
              {[chapterTag(v.update.chapter), ...v.entities.map((e) => e.name)].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-[1_1_300px] rounded-[10px] bg-warn-tint px-4 py-3.5">
              <div className="text-xs font-semibold tracking-[0.6px] text-warn uppercase">GM proposes</div>
              <p className="mt-1.5 font-serif text-[17px]">{v.update.bodyMd}</p>
            </div>
            <div className="flex-[1_1_300px] rounded-[10px] bg-canon-tint px-4 py-3.5">
              <div className="text-xs font-semibold tracking-[0.6px] text-accent-ink uppercase">Current canon · {v.conflictWith?.label ?? "existing record"}</div>
              <p className="mt-1.5 font-serif text-[17px]">{v.conflictWith?.body ?? v.conflict}</p>
            </div>
          </div>
          <UpdateItem
            layout="stack"
            head={null}
            body={v.update.bodyMd}
            hideBody
            approve={<RejectButton v={v} path={path} label="Keep canon, reject" primary />}
            reject={<ApproveButton v={v} path={path} label="Accept and overrule" />}
            edit={editProps(v, path)}
            editLabel="Edit before deciding"
          />
        </section>
      ))}

      {sceneGroups.map(({ scene, rows }) => (
        <section key={scene?.id ?? "none"} aria-label={scene ? `Updates from ${sceneLabel(scene)}` : "Updates without a scene"} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-subtle px-5 py-3 text-[13px]">
            <div className="min-w-0 flex-1">
              {scene ? (
                <>
                  <Link href={`${base}#chapters`} className="font-semibold text-ink hover:underline">
                    {sceneLabel(scene)}
                    {scene.place && <> at {scene.place.name}</>}
                  </Link>
                  {scene.summary && <p className="line-clamp-1 text-muted">{scene.summary}</p>}
                </>
              ) : (
                <span className="font-semibold text-muted">Not from a logged scene</span>
              )}
            </div>
            {scene && rows.length > 1 && (
              <ActionForm action={approveScene}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="sceneId" value={scene.id} />
                <input type="hidden" name="path" value={path} />
                <button className="btn btn-sm">Approve scene ({rows.length})</button>
              </ActionForm>
            )}
          </div>
          <ul>
            {rows.map((v) => (
              <li key={v.update.id} className="border-b border-line-soft px-5 py-4 last:border-b-0">
                <UpdateItem
                  head={<UpdateMeta v={v} base={base} status={false} />}
                  body={v.update.bodyMd}
                  foot={
                    <>
                      <Knows v={v} />
                      <TagChips tags={extraTags(v)} />
                    </>
                  }
                  approve={<ApproveButton v={v} path={path} />}
                  reject={<RejectButton v={v} path={path} />}
                  edit={editProps(v, path)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {showChanges && <PageChanges changes={changes} base={base} path={path} campaignId={campaignId} />}

      {showPages && <PageQueue scope={scope} path={path} collapse={f === "all" && pages.length > 5} />}

      {n === 0 && pages.length === 0 ? (
        <p className="text-muted">Nothing to review.</p>
      ) : (
        f !== "all" && counts[f as keyof typeof counts] === 0 && <p className="text-muted">Nothing here. <Link href={path} className="link">Show all</Link></p>
      )}
    </>
  );
}
