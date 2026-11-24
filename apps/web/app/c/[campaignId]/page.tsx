import Link from "next/link";
import { setApprovalMode } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { app, campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

const MODES = [
  ["review", "Review everything"],
  ["batch", "Batch review"],
  ["autopilot", "Autopilot"],
  ["mixed", "Mixed (by severity)"],
] as const;

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="text-stone-400">none</span>;
  if (Array.isArray(v)) return v.length ? <ul className="list-disc pl-5">{v.map((x, i) => <li key={i}><Value v={x} /></li>)}</ul> : <span className="text-stone-400">none</span>;
  if (typeof v === "object")
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3">
        {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{k}</dt>
            <dd><Value v={x} /></dd>
          </div>
        ))}
      </dl>
    );
  return <>{String(v)}</>;
}

export default async function Dashboard({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const scope = await campaignScope(campaignId);
  const d = (await app().views.dashboard(scope))!;
  const c = d.campaign;
  const path = `/c/${campaignId}`;
  const settings = Object.entries(c.settings);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{c.name}</h1>
          <p className="text-sm text-stone-500">
            Chapter {c.currentChapter}
            {c.asOfStoryTime && <> · as of {c.asOfStoryTime}</>}
            {c.lastSessionAt && <> · last session {new Date(c.lastSessionAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</>}
          </p>
        </div>
        {d.reviewCount > 0 && (
          <Link href={`${path}/review`} className="btn-primary">
            {d.reviewCount} update{d.reviewCount === 1 ? "" : "s"} to review
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="label mb-2">Approval of AI writes</h2>
          <ActionForm action={setApprovalMode} className="grid gap-2 text-sm">
            <input type="hidden" name="campaignId" value={c.id} />
            <input type="hidden" name="path" value={path} />
            <select name="mode" defaultValue={c.approvalMode} className="input" aria-label="Approval mode">
              {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1 text-xs text-stone-500">Mixed mode: per severity</legend>
              {(["minor", "major"] as const).map((sev) => (
                <label key={sev} className="grid gap-1 text-xs">
                  {sev}
                  <select name={sev} defaultValue={c.severityPolicy[sev]} className="input">
                    {MODES.filter(([v]) => v !== "mixed").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              ))}
            </fieldset>
            <button className="btn w-fit">Save</button>
          </ActionForm>
          <h2 className="label mt-5 mb-2">Settings</h2>
          {settings.length === 0 ? <p className="text-sm text-stone-500">Set during intake.</p> : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {settings.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-stone-500">{k.replace("_", " ")}</dt>
                  <dd>{Array.isArray(v) ? v.join(", ") || "none" : String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="card">
          <h2 className="label mb-2">PC sheet</h2>
          {d.pcSheet ? <div className="text-sm"><Value v={d.pcSheet.data} /></div> : <p className="text-sm text-stone-500">Stored at character creation.</p>}
        </section>

        <section className="card">
          <h2 className="label mb-2">Open threads</h2>
          {d.openThreads.length === 0 ? <p className="text-sm text-stone-500">None open.</p> : (
            <ul className="space-y-2 text-sm">
              {d.openThreads.map((t) => (
                <li key={t.id}>
                  <p className="font-medium">{t.title}</p>
                  {t.bodyMd && <p className="text-stone-600 dark:text-stone-400">{t.bodyMd}</p>}
                </li>
              ))}
            </ul>
          )}
          {d.resolvedThreads.length > 0 && <p className="mt-3 text-xs text-stone-500">{d.resolvedThreads.length} resolved.</p>}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="label mb-2">Chapters</h2>
          {d.chapters.length === 0 ? <p className="text-sm text-stone-500">No chapter closed yet.</p> : (
            <ol className="space-y-3">
              {d.chapters.map((ch) => (
                <li key={ch.id}>
                  <p className="font-serif text-lg font-semibold">
                    <span className="mr-2 font-mono text-xs text-stone-500">ch-{String(ch.number).padStart(2, "0")}</span>
                    {ch.title}
                  </p>
                  <p className="font-serif text-stone-700 dark:text-stone-300">{ch.summaryMd}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card">
          <h2 className="label mb-2">Rulings</h2>
          {d.rulings.length === 0 ? <p className="text-sm text-stone-500">None yet.</p> : (
            <ul className="space-y-2 font-serif">
              {d.rulings.map((r) => <li key={r.id}>&ldquo;{r.text}&rdquo;</li>)}
            </ul>
          )}
          {d.voiceAnchor && (
            <>
              <h2 className="label mt-5 mb-2">Voice anchor</h2>
              <blockquote className="border-l-2 border-stone-300 pl-3 font-serif italic dark:border-stone-600">{d.voiceAnchor.sampleVerbatim}</blockquote>
              <p className="mt-1 text-xs text-stone-500">Interior voice: {d.voiceAnchor.interiorLevel}</p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
