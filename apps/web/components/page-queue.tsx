import Link from "next/link";
import type { Scope } from "@continuity/core";
import { approvePage, approvePages, rejectPage } from "@/app/actions";
import { app, basePath } from "@/lib/server";
import { ActionForm } from "./action-form";
import { TYPE_LABEL } from "./wiki-browser";

/** Pages the GM drafted that wait for approval (SPEC Phase 0: nothing drafted becomes canon without it). */
export async function PageQueue({ scope, path, collapse = false }: { scope: Scope; path: string; collapse?: boolean }) {
  const pages = await (await app()).views.pageQueue(scope);
  if (!pages.length) return null;
  const base = basePath(scope);
  const list = (
    <ul>
      {pages.map(({ entity: e, line, sections }) => (
        <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 last:border-b-0">
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="pill bg-pending font-bold text-[#1c1e21]">Draft</span>
              <span>{TYPE_LABEL[e.type]}</span>
              <span>
                {sections} section{sections === 1 ? "" : "s"}
              </span>
              {e.source === "unverified" && <span className="font-semibold text-warn">Unverified</span>}
              {e.campaignId && <span>This campaign</span>}
            </div>
            <Link href={`${base}/e/${e.slug}`} className="mt-1 block font-serif text-[19px] font-semibold text-ink hover:text-accent">
              {e.name}
            </Link>
            {line && <p className="line-clamp-2 text-muted">{line}</p>}
          </div>
          <div className="flex gap-2">
            <ActionForm action={approvePage}>
              <input type="hidden" name="entityId" value={e.id} />
              <input type="hidden" name="path" value={path} />
              <button className="btn-primary btn-sm" aria-label={`Approve ${e.name}`}>
                Approve
              </button>
            </ActionForm>
            <ActionForm action={rejectPage}>
              <input type="hidden" name="entityId" value={e.id} />
              <input type="hidden" name="path" value={path} />
              <button className="btn btn-sm" aria-label={`Reject ${e.name}`}>
                Reject
              </button>
            </ActionForm>
          </div>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="New pages" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-5 py-3 text-[13px] text-muted">
        <span>New pages the GM drafted</span>
        <span className="flex items-center gap-3">
          {pages.length} waiting
          <ActionForm action={approvePages} className="flex flex-col items-end">
            {pages.map(({ entity: e }) => (
              <input key={e.id} type="hidden" name="entityId" value={e.id} />
            ))}
            <input type="hidden" name="path" value={path} />
            <button className="btn-primary btn-sm">Approve all pages ({pages.length})</button>
          </ActionForm>
        </span>
      </div>
      {collapse ? (
        <details className="group">
          <summary className="cursor-pointer list-none px-5 py-3 text-[13px] font-medium text-accent hover:text-accent-hover [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show the {pages.length} pages</span>
            <span className="hidden group-open:inline">Hide the list</span>
          </summary>
          {list}
        </details>
      ) : (
        list
      )}
    </section>
  );
}
