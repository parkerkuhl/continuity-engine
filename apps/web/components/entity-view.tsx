import type { Scope } from "@continuity/core";
import { notFound } from "next/navigation";
import { addSection, editAliases, editSection, editSummary, restoreVersion, setSectionVisibility } from "@/app/actions";
import { app, basePath } from "@/lib/server";
import { ActionForm } from "./action-form";
import { LockIcon } from "./icons";
import { Markdown } from "./markdown";
import { ConfirmedForm, InlineEditor } from "./section-editor";
import { UpdateMeta } from "./update-card";
import { SourceBadge } from "./wiki-browser";

function stateText(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  const md = typeof o.bodyMd === "string" ? o.bodyMd : typeof o.summary === "string" ? o.summary : "";
  return md.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
}

export async function EntityView({ scope, slug }: { scope: Scope; slug: string }) {
  const view = await app().views.entity(scope, slug);
  if (!view) notFound();
  const { page } = view;
  const base = basePath(scope);
  const path = `${base}/e/${page.slug}`;
  const campaignId = scope.campaign?.id ?? "";
  const hidden = { entityId: page.id, campaignId, path };

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <header>
          <p className="label">{page.type}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-serif text-3xl font-semibold">
            {page.name}
            <SourceBadge source={page.source} />
          </h1>
          <ActionForm action={editAliases} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="entityId" value={page.id} />
            <input type="hidden" name="path" value={path} />
            <label htmlFor="aliases" className="label">
              Aliases
            </label>
            <input id="aliases" name="aliases" defaultValue={page.aliases.join(", ")} className="input max-w-md" placeholder="Comma-separated" />
            <button className="btn">Save aliases</button>
          </ActionForm>
          {page.source === "unverified" && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              Unverified: drafted from an established setting and not yet checked. Claude sees it labeled as such.
            </p>
          )}
        </header>

        <section className="mt-6" aria-labelledby="summary-h">
          <h2 id="summary-h" className="label mb-1">
            Summary
          </h2>
          <InlineEditor action={editSummary} body={page.summary} hidden={hidden} label="summary">
            <Markdown>{page.summary}</Markdown>
          </InlineEditor>
        </section>

        {page.sections.map((s) => (
          <section key={s.id} className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800" aria-labelledby={`s-${s.id}`}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 id={`s-${s.id}`} className="font-serif text-xl font-semibold">
                {s.heading}
              </h2>
              {s.lockedByUser && (
                <span className="badge border-sky-300 text-sky-800 dark:border-sky-700 dark:text-sky-300" title="You edited this section, so AI writes to it are refused.">
                  <LockIcon className="h-3 w-3" /> locked
                </span>
              )}
              {s.visibility === "secret" && (
                <span className="badge border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{s.knownByPc ? "secret, known to the PC" : "secret"}</span>
              )}
              {s.campaignId && <span className="badge border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300">this campaign</span>}
              <form action={setSectionVisibility} className="ml-auto">
                <input type="hidden" name="entityId" value={page.id} />
                <input type="hidden" name="key" value={s.key} />
                <input type="hidden" name="campaignId" value={s.campaignId ?? ""} />
                <input type="hidden" name="path" value={path} />
                <input type="hidden" name="visibility" value={s.visibility === "secret" ? "public" : "secret"} />
                <button className="btn text-xs">Make {s.visibility === "secret" ? "public" : "secret"}</button>
              </form>
            </div>
            <InlineEditor action={editSection} body={s.bodyMd} hidden={{ ...hidden, key: s.key, campaignId: s.campaignId ?? "" }} label={`section ${s.heading}`}>
              <Markdown>{s.bodyMd}</Markdown>
            </InlineEditor>
          </section>
        ))}

        {view.hiddenSections > 0 && (
          <p className="mt-6 rounded border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 dark:border-stone-700">
            {view.hiddenSections} secret section{view.hiddenSections === 1 ? " is" : "s are"} hidden. Turn spoilers on to see {view.hiddenSections === 1 ? "it" : "them"}.
          </p>
        )}

        <details className="mt-8 card">
          <summary className="cursor-pointer text-sm font-semibold">Add a section</summary>
          <ConfirmedForm action={addSection} hidden={hidden} verb="Add" trigger="Add section">
            <div className="mt-3 grid gap-2">
              <input name="heading" placeholder="Heading" className="input" aria-label="New section heading" required />
              <textarea name="body" rows={4} placeholder="Markdown" className="input font-serif" aria-label="New section body" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="visibility" value="secret" /> Secret (hidden in player view)
              </label>
            </div>
          </ConfirmedForm>
        </details>
      </div>

      <aside className="space-y-6">
        {scope.campaign && (
          <section className="card">
            <h2 className="label mb-2">Updates in this campaign</h2>
            {view.updates.length === 0 && view.hiddenUpdates === 0 && <p className="text-sm text-stone-500">None yet.</p>}
            <ul className="space-y-3">
              {view.updates.map((v) => (
                <li key={v.update.id}>
                  <UpdateMeta v={v} base={base} />
                  <p className="mt-1 font-serif">{v.update.bodyMd}</p>
                </li>
              ))}
            </ul>
            {view.hiddenUpdates > 0 && (
              <p className="mt-3 text-xs text-stone-500">
                {view.hiddenUpdates} update{view.hiddenUpdates === 1 ? "" : "s"} the PC doesn&apos;t know {view.hiddenUpdates === 1 ? "is" : "are"} hidden.
              </p>
            )}
          </section>
        )}
        <section className="card">
          <h2 className="label mb-2">History</h2>
          <ol className="space-y-3 text-sm">
            {view.history.map((v) => (
              <li key={v.id} className="border-l-2 border-stone-200 pl-3 dark:border-stone-700">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <time dateTime={v.createdAt}>{new Date(v.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
                  <span className={v.author === "user" ? "font-semibold text-sky-700 dark:text-sky-300" : ""}>{v.author === "user" ? "you" : "Claude"}</span>
                  {v.editKind && <span className="badge border-stone-300">{v.editKind}</span>}
                </div>
                <p className="mt-0.5">{v.label}{v.reason ? `: ${v.reason.startsWith("restored version") ? "restored an earlier version" : v.reason}` : ""}</p>
                {stateText(v.after) && <p className="mt-1 line-clamp-3 font-serif text-stone-600 dark:text-stone-400">{stateText(v.after)}</p>}
                {v.before !== null && v.after !== null && (
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                    <ConfirmedForm action={restoreVersion} hidden={{ versionId: v.id, side: "before", path }} verb="Undo" trigger="Undo this change" />
                    <ConfirmedForm action={restoreVersion} hidden={{ versionId: v.id, side: "after", path }} verb="Restore" trigger="Restore this version" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </article>
  );
}
