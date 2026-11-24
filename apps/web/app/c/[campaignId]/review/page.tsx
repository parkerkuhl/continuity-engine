import { approveAllMinor, approveUpdate, editUpdate, rejectUpdate } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { UpdateMeta } from "@/components/update-card";
import { app, campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function Review({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const scope = await campaignScope(campaignId);
  const { items, hidden } = await app().views.reviewQueue(scope);
  const base = `/c/${campaignId}`;
  const path = `${base}/review`;
  const minor = items.filter((i) => i.update.severity === "minor" && !i.update.conflictsWith).length;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Review queue</h1>
          <p className="text-sm text-stone-500">
            Proposed updates from Claude. Approving makes one canon; rejecting keeps it on record. Conflicts are pinned on top.
          </p>
        </div>
        <ActionForm action={approveAllMinor}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="path" value={path} />
          <button className="btn-primary" disabled={minor === 0}>
            Approve all {minor} minor
          </button>
        </ActionForm>
      </div>
      {hidden > 0 && (
        <p className="mt-4 rounded border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 dark:border-stone-700">
          {hidden} proposed update{hidden === 1 ? "" : "s"} the PC doesn&apos;t know {hidden === 1 ? "is" : "are"} hidden. Turn spoilers on to review {hidden === 1 ? "it" : "them"}.
        </p>
      )}
      {items.length === 0 && hidden === 0 && <p className="mt-8 text-stone-500">Nothing to review.</p>}
      <ul className="mt-6 space-y-4">
        {items.map((v) => (
          <li key={v.update.id} className={`card ${v.conflict ? "border-red-300 dark:border-red-800" : ""}`}>
            {v.conflict && (
              <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                <span className="font-semibold">Conflict.</span> {v.conflict}
              </p>
            )}
            <UpdateMeta v={v} base={base} />
            <p className="mt-2 font-serif text-[17px]">{v.update.bodyMd}</p>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <ActionForm action={approveUpdate}>
                <input type="hidden" name="updateId" value={v.update.id} />
                <input type="hidden" name="path" value={path} />
                <button className="btn-primary">Approve</button>
              </ActionForm>
              <ActionForm action={rejectUpdate}>
                <input type="hidden" name="updateId" value={v.update.id} />
                <input type="hidden" name="path" value={path} />
                <button className="btn-danger">Reject</button>
              </ActionForm>
              <details className="min-w-[16rem] flex-1">
                <summary className="btn cursor-pointer list-none">Edit</summary>
                <ActionForm action={editUpdate} className="mt-2 grid gap-2">
                  <input type="hidden" name="updateId" value={v.update.id} />
                  <input type="hidden" name="path" value={path} />
                  <textarea name="body" defaultValue={v.update.bodyMd} rows={3} className="input font-serif" aria-label={`Edit update #${v.update.seq}`} />
                  <div className="flex gap-2">
                    <select name="severity" defaultValue={v.update.severity} className="input w-auto" aria-label="Severity">
                      <option value="minor">minor</option>
                      <option value="major">major</option>
                    </select>
                    <button className="btn">Save edit</button>
                  </div>
                </ActionForm>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
