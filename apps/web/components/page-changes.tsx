import Link from "next/link";
import type { PageChange } from "@continuity/core";
import { keepAllPageChanges, keepPageChange, restoreVersion } from "@/app/actions";
import { ago, sceneLabel } from "@/lib/format";
import { ActionForm } from "./action-form";
import { ConfirmedForm } from "./section-editor";
import { WordDiff } from "./word-diff";

/**
 * UX review #4: the GM's page edits during play, which apply at once, listed for the user to look over.
 * Keep takes a row off the list (a browser cookie remembers it); Undo restores the text from before.
 */
export function PageChanges({ changes, base, path, campaignId }: { changes: PageChange[]; base: string; path: string; campaignId: string }) {
  if (!changes.length) return null;
  return (
    <section aria-labelledby="page-changes-h" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-subtle px-5 py-3 text-[13px] text-muted">
        <span>
          <b id="page-changes-h" className="text-ink">
            Page changes
          </b>{" "}
          · The GM edited these pages during play. They're already on the pages.
        </span>
        {changes.length > 1 && (
          <ActionForm action={keepAllPageChanges}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="path" value={path} />
            <button className="btn btn-sm">Keep all ({changes.length})</button>
          </ActionForm>
        )}
      </div>
      <ul>
        {changes.map((c) => {
          const anchor = c.sectionId ? `#s-${c.sectionId}` : "#summary-h";
          const where = `${c.entity.name} · ${c.heading}`;
          return (
            <li key={c.undoVersionId} className="flex flex-col gap-2 border-b border-line-soft px-5 py-4 last:border-b-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
                <Link href={`${base}/e/${c.entity.slug}${anchor}`} className="link font-semibold">
                  {where}
                </Link>
                <span className="text-faint">
                  GM{sceneLabel(c.scene) && <> · {sceneLabel(c.scene)}</>} ·{" "}
                  <time dateTime={c.at} title={new Date(c.at).toLocaleString("en-US")}>
                    {ago(c.at)}
                  </time>
                </span>
              </div>
              <WordDiff before={c.before} after={c.after} className="max-h-48 overflow-y-auto rounded-[10px] bg-canvas px-3.5 py-2.5 font-serif text-[15px]" />
              <div className="flex flex-wrap items-center gap-2">
                <ActionForm action={keepPageChange}>
                  <input type="hidden" name="campaignId" value={campaignId} />
                  <input type="hidden" name="versionIds" value={c.versionIds.join(",")} />
                  <input type="hidden" name="path" value={path} />
                  <button className="btn-primary btn-sm">Keep</button>
                </ActionForm>
                <ConfirmedForm
                  action={restoreVersion}
                  hidden={{ versionId: c.undoVersionId, side: "before", path }}
                  submit="Undo change"
                  trigger="Undo"
                  context={where}
                  before={c.after}
                  after={c.before}
                  note="The page goes back to the text from before the GM's edit, and the section locks against GM edits, as with any edit of yours. The GM sees it at the start of the next session."
                  triggerClass="btn btn-sm"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
