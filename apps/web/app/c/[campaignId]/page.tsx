import Link from "next/link";
import { setApprovalMode, setCampaignSpoilers } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PcSheetBody, cap, text } from "@/components/pc-sheet";
import { chapterTag } from "@/components/update-card";
import { app, campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

const MODES = [
  ["review", "Review everything", "Nothing counts until you approve it."],
  ["batch", "Batch review", "Usable right away as soft canon; you approve later."],
  ["autopilot", "Autopilot", "Straight to canon; fix things afterward."],
  ["mixed", "Mixed by severity", "Pick a rule for minor and for major updates."],
] as const;
const MODE_NAME: Record<string, string> = { review: "review", batch: "batch review", autopilot: "autopilot" };

const SETTING_LABEL: Record<string, string> = { genre: "Genre", tone: "Tone", difficulty: "Difficulty", length: "Length", pacing: "Pacing", dice: "Dice", turn_length: "Turn length" };


function Card({ title, id, action, children, className = "" }: { title: string; id?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={`card flex scroll-mt-6 flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id ? `${id}-h` : undefined} className="card-title">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function Dashboard({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const scope = await campaignScope(campaignId);
  const d = (await app().views.dashboard(scope))!;
  const c = d.campaign;
  const path = `/c/${campaignId}`;
  const s = c.settings;
  const pc = (d.pcSheet?.data ?? null) as Record<string, unknown> | null;
  const h = d.hidden;
  const hiddenParts = [
    h.gmNotes && `${h.gmNotes} GM note${h.gmNotes === 1 ? "" : "s"}`,
    h.secretSections && `${h.secretSections} secret section${h.secretSections === 1 ? "" : "s"}`,
    h.updates && `${h.updates} update${h.updates === 1 ? "" : "s"} the PC doesn't know`,
  ].filter(Boolean);
  const pcName = pc && typeof pc.name === "string" ? pc.name : scope.pc?.name;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{c.name}</h1>
          <p className="mt-1.5 text-muted">
            World: {scope.world.name} · Chapter {c.currentChapter}
            {c.asOfStoryTime && <> · as of {c.asOfStoryTime}</>}
            {c.lastSessionAt && <> · Last session {new Date(c.lastSessionAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
          </p>
        </div>
        {d.reviewCount > 0 && (
          <Link href={`${path}/review`} className="btn-primary">
            {d.reviewCount} update{d.reviewCount === 1 ? "" : "s"} to review
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <Card title="How GM updates become canon">
          <ActionForm action={setApprovalMode} className="flex flex-col gap-2">
            <input type="hidden" name="campaignId" value={c.id} />
            <input type="hidden" name="path" value={path} />
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Approval mode</legend>
              {MODES.map(([v, label, note]) => (
                <label key={v} className="flex cursor-pointer gap-2.5 rounded-lg border border-line px-3 py-2.5 has-[input:checked]:border-accent has-[input:checked]:bg-accent-tint has-[input:checked]:ring-1 has-[input:checked]:ring-accent">
                  <input type="radio" name="mode" value={v} defaultChecked={c.approvalMode === v} className="mt-1 accent-accent" />
                  <span className="min-w-0 flex-1">
                    <b>{label}</b>
                    <br />
                    <span className="text-[13px] text-muted">
                      {v === "mixed" && c.approvalMode === "mixed" ? `Minor: ${MODE_NAME[c.severityPolicy.minor]} · Major: ${MODE_NAME[c.severityPolicy.major]}` : note}
                    </span>
                    {v === "mixed" && (
                      <span className="mt-2 grid grid-cols-2 gap-2">
                        {(["minor", "major"] as const).map((sev) => (
                          <span key={sev} className="grid gap-1 text-xs text-muted">
                            {cap(sev)}
                            <select name={sev} defaultValue={c.severityPolicy[sev]} className="input h-9 text-sm text-ink" aria-label={`${cap(sev)} updates`}>
                              {MODES.filter(([m]) => m !== "mixed").map(([m, l]) => (
                                <option key={m} value={m}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="text-[13px] text-muted">Deaths, secrets spreading, faction shifts and world rules always count as major.</p>
            <button className="btn btn-sm w-fit">Save approval mode</button>
          </ActionForm>
        </Card>

        <Card title="Player character">
          {!pc ? (
            <p className="text-muted">The GM stores the PC sheet at character creation.</p>
          ) : (
            <>
              <PcSheetBody data={pc} />
              {scope.pc && (
                <Link href={`${path}/e/${scope.pc.slug}`} className="link">
                  Open {scope.pc.name}&apos;s page
                </Link>
              )}
            </>
          )}
        </Card>

        <Card title="Story settings">
          {Object.keys(s).length === 0 && !d.voiceAnchor ? (
            <p className="text-muted">Set during intake.</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
              {d.voiceAnchor && (
                <>
                  <dt className="text-muted">Interior voice</dt>
                  <dd>{cap(d.voiceAnchor.interiorLevel)}</dd>
                </>
              )}
              {Object.entries(SETTING_LABEL)
                .filter(([k]) => s[k as keyof typeof s])
                .map(([k, l]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{l}</dt>
                    <dd>{text(s[k as keyof typeof s])}</dd>
                  </div>
                ))}
              {(s.lines || s.veils) && (
                <>
                  <dt className="text-muted">Boundaries</dt>
                  <dd title={[...(s.lines ?? []).map((x) => `Line: ${x}`), ...(s.veils ?? []).map((x) => `Veil: ${x}`)].join("\n")}>
                    {s.lines?.length ?? 0} line{s.lines?.length === 1 ? "" : "s"} · {s.veils?.length ?? 0} veil{s.veils?.length === 1 ? "" : "s"}
                  </dd>
                </>
              )}
            </dl>
          )}
          {d.voiceAnchor && (
            <blockquote className="border-l-2 border-line-strong pl-3 font-serif text-[15px] text-body italic">{d.voiceAnchor.sampleVerbatim}</blockquote>
          )}
        </Card>

        <Card title="Open threads" id="threads" action={d.resolvedThreads.length > 0 ? <span className="text-[13px] text-muted">{d.resolvedThreads.length} resolved</span> : undefined}>
          {d.openThreads.length === 0 ? (
            <p className="text-muted">None open.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {d.openThreads.map((t) => (
                <div key={t.id} className="border-l-[3px] border-pending pl-2.5">
                  <b>{t.title}</b>
                  <div className="text-[13px] text-muted">
                    {[t.openedChapter !== null && `Opened ${chapterTag(t.openedChapter)}`, t.tags.join(", ")].filter(Boolean).join(" · ")}
                  </div>
                  {t.bodyMd && <p className="text-[13px] text-body">{t.bodyMd}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Chapters" id="chapters">
          <div className="flex flex-col gap-2.5">
            <div>
              <b>{c.currentChapter} · This chapter</b> <span className="pill bg-accent-soft px-2 py-px font-normal text-accent-ink">In progress</span>
            </div>
            {[...d.chapters].reverse().map((ch) => (
              <div key={ch.id}>
                <b>
                  {ch.number} · {ch.title}
                </b>
                <div className="text-[13px] text-muted">{ch.summaryMd}</div>
              </div>
            ))}
            {d.chapters.length === 0 && <p className="text-[13px] text-muted">No chapter closed yet.</p>}
          </div>
        </Card>

        <Card title="Spoilers">
          <form action={setCampaignSpoilers} className="flex items-center justify-between gap-3">
            <input type="hidden" name="campaignId" value={c.id} />
            <input type="hidden" name="on" value={scope.spoilers ? "0" : "1"} />
            <span>
              Show GM notes and secret sections
              <br />
              <span className="text-[13px] text-muted">Off: you see only what {pcName ?? "the PC"} knows.</span>
            </span>
            <button
              type="submit"
              role="switch"
              aria-checked={scope.spoilers}
              aria-label="Show spoilers"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${scope.spoilers ? "bg-[#4a3389]" : "bg-line-strong"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${scope.spoilers ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </form>
          <div className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-muted">
            {scope.spoilers ? "GM view: everything is showing." : hiddenParts.length ? `Hidden right now: ${hiddenParts.join(", ")}.` : "Nothing is hidden right now."}
          </div>
        </Card>

        <Card title="Rulings" id="rulings">
          {d.rulings.length === 0 ? (
            <p className="text-muted">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 font-serif text-[15px]">
              {d.rulings.map((r) => (
                <li key={r.id}>&ldquo;{r.text}&rdquo;</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
