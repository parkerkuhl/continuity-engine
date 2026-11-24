import Link from "next/link";
import type { ReactNode } from "react";
import { TO_PC_KEY, cleanLabel, type Scope, type Version } from "@continuity/core";
import { notFound } from "next/navigation";
import { addSection, approvePage, editAliases, editSection, editSummary, markCanon, rejectPage, restoreVersion } from "@/app/actions";
import { app, basePath } from "@/lib/server";
import { ActionForm } from "./action-form";
import { LockIcon } from "./icons";
import { Markdown } from "./markdown";
import { ConfirmedForm, InlineEditor } from "./section-editor";
import { EmptySlots, type Slot } from "./empty-slots";
import { ApproveButton, Knows, RejectButton, Severity, StatusPill, TagChips, chapterTag, editProps, extraTags } from "./update-card";
import { PcSheetBody, text } from "./pc-sheet";
import { UpdateItem } from "./update-item";
import { VisibilityButton } from "./visibility-button";
import { SourcePill, TYPE_LABEL, TYPE_PLURAL } from "./wiki-browser";

function stateText(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  const md = typeof o.bodyMd === "string" ? o.bodyMd : typeof o.summary === "string" ? o.summary : "";
  return md
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 14 ? `${d} day${d === 1 ? "" : "s"} ago` : new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
};

/** "edited the Wants section", "created the page", "restored an earlier version of the Wants section". */
function historyLine(v: Version & { label: string }) {
  const what = v.label === "Page" ? "the page" : `the ${v.label.replace(/^Section "(.*)"$/, "$1")} section`;
  if (v.reason?.startsWith("restored version")) return `restored an earlier version of ${what}`;
  if (v.before === null) return `created ${what}`;
  return `edited ${what}`;
}

const TITLE = "section-title";

/** A block of facts drawn from play (updates, scenes, the PC sheet), set apart from the written prose. */
function FromPlay({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[10px] bg-canvas px-4 py-3 text-[15px]">
      <div className="text-xs font-semibold tracking-[0.6px] text-muted uppercase">From play</div>
      {children}
    </div>
  );
}

export async function EntityView({ scope, slug, tab: tabParam }: { scope: Scope; slug: string; tab?: string }) {
  const view = await (await app()).views.entity(scope, slug);
  if (!view) notFound();
  const { page } = view;
  const base = basePath(scope);
  const wiki = scope.campaign ? `${base}/wiki` : base;
  const path = `${base}/e/${page.slug}`;
  const campaignId = scope.campaign?.id ?? "";
  const hidden = { entityId: page.id, campaignId, path };
  const { profile } = view;
  const outlineKeys = new Set(profile.outline.map((o) => o.key));
  // Who this character is to the PC, from the campaign's "To the PC" section (already filtered by the view).
  const toPcSection = scope.campaign && page.type === "character" ? page.sections.find((x) => x.key === TO_PC_KEY) : undefined;
  const toPc = cleanLabel(toPcSection?.bodyMd.trim().split("\n")[0] ?? "") || null;

  /** What play recorded for an outline slot, shown under its prose. */
  const recorded = (key: string): ReactNode => {
    if (key === "relationships" && (profile.relationships.length || profile.appearsWith.length)) {
      return (
        <FromPlay>
          {profile.relationships.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {profile.relationships.map((r) => (
                <li key={`${r.update.id}-${r.other.id}`}>
                  <Link href={`${base}/e/${r.other.slug}`} className="link font-semibold">
                    {r.other.name}
                  </Link>
                  : {r.update.bodyMd} {r.update.status === "proposed" && <StatusPill status="proposed" />}
                </li>
              ))}
            </ul>
          )}
          {profile.appearsWith.length > 0 && (
            <p className="text-muted">
              Often in scenes with:{" "}
              {profile.appearsWith.slice(0, 8).map((w, i) => (
                <span key={w.other.id}>
                  {i > 0 && ", "}
                  <Link href={`${base}/e/${w.other.slug}`} className="link">
                    {w.other.name}
                  </Link>{" "}
                  ({w.scenes} scene{w.scenes === 1 ? "" : "s"})
                </span>
              ))}
            </p>
          )}
        </FromPlay>
      );
    }
    const carried = Array.isArray(profile.pcSheet?.data.inventory) ? (profile.pcSheet!.data.inventory as unknown[]) : [];
    if (key === "inventory" && (carried.length || profile.items.length)) {
      return (
        <FromPlay>
          {carried.length > 0 && (
            <ul className="list-disc pl-5">
              {carried.map((x, i) => (
                <li key={i}>{text(x)}</li>
              ))}
            </ul>
          )}
          {profile.items.length > 0 && (
            <ul className="flex flex-col gap-1">
              {profile.items.map((u) => (
                <li key={u.id}>
                  {u.bodyMd}{" "}
                  <span className="text-xs text-faint">
                    #{u.seq}
                    {u.chapter !== null && <> · {chapterTag(u.chapter)}</>}
                  </span>{" "}
                  {u.status === "proposed" && <StatusPill status="proposed" />}
                </li>
              ))}
            </ul>
          )}
        </FromPlay>
      );
    }
    return null;
  };

  const sectionCard = (s: (typeof page.sections)[number], extra: ReactNode, compact = false) => {
    const secret = s.visibility === "secret";
    return (
      <InlineEditor
        key={s.id}
        action={editSection}
        body={s.bodyMd}
        hidden={{ ...hidden, key: s.key, campaignId: s.campaignId ?? "" }}
        label={`section ${s.heading}`}
        context={`${page.name} · ${s.heading}`}
        labelledBy={`s-${s.id}`}
        className={secret ? "rounded-xl border border-dashed border-secret-line bg-secret-tint px-6 py-5" : compact ? "card-sm" : "card"}
        title={
          <h2 id={`s-${s.id}`} className={compact ? "text-[15px] font-semibold" : TITLE}>
            {s.heading}
          </h2>
        }
        meta={
          <>
            {s.lockedByUser && (
              <span className="flex items-center gap-1.5 text-xs text-muted" title="You edited this section, so GM writes to it are refused.">
                <LockIcon className="h-[13px] w-[13px]" />
                Edited by you · locked
              </span>
            )}
            {s.campaignId && <span className="pill bg-sunken text-body">This campaign</span>}
            {secret && (
              <span className="flex items-center gap-1 text-xs font-semibold text-secret">
                <LockIcon className="h-[13px] w-[13px]" />
                {s.knownByPc ? "Secret · the PC knows it" : "Secret section"}
              </span>
            )}
            <VisibilityButton hidden={{ entityId: page.id, key: s.key, campaignId: s.campaignId ?? "", path }} secret={secret} heading={s.heading} />
          </>
        }
      >
        <Markdown>{s.bodyMd}</Markdown>
        {extra}
      </InlineEditor>
    );
  };

  const menu: [string, string][] = [["Current state", "summary-h"]];
  if (profile.pcSheet) menu.push(["Character sheet", "sheet-h"]);
  const emptySlots: Slot[] = [];
  for (const o of profile.outline) {
    if (o.sectionId === "hidden") continue;
    const sec = o.sectionId ? page.sections.find((x) => x.id === o.sectionId) : undefined;
    if (sec && sec === toPcSection && toPc) continue; // shown as the pill under the name and a small card in the side column
    if (sec) menu.push([sec.heading, `s-${sec.id}`]);
    else if (recorded(o.key)) menu.push([o.heading, `slot-${o.key}`]);
    else emptySlots.push({ key: o.key, heading: o.heading, hidden: { ...hidden, heading: o.heading }, context: `${page.name} · ${o.heading}` });
  }
  for (const x of page.sections.filter((x) => !outlineKeys.has(x.key))) menu.push([x.heading, `s-${x.id}`]);
  const proposedCount = view.updates.filter((v) => v.update.status === "proposed").length;
  const tabs: [string, string, number?, boolean?][] = [["page", "Page"]];
  if (scope.campaign) {
    tabs.push(["updates", "Updates", proposedCount || view.updates.length, proposedCount > 0]);
    const first = page.name.split(" ")[0] ?? page.name;
    tabs.push(["knows", `What ${/^(the|a|an)$/i.test(first) ? page.name : first} knows`, profile.knows.length]);
  }
  tabs.push(["history", "History", view.history.length]);
  const tab = tabs.some(([k]) => k === tabParam) ? tabParam! : "page";

  const knowsNewest = [...profile.knows].sort((a, b) => b.seq - a.seq);
  const knowItem = (u: (typeof profile.knows)[number]) => (
    <li key={u.id} className="flex flex-wrap items-baseline gap-x-2 leading-snug">
      <span className="font-serif text-[15px]">{u.bodyMd}</span>
      <span className="text-xs text-faint">
        #{u.seq}
        {u.chapter !== null && <> · {chapterTag(u.chapter)}</>}
      </span>
      {u.status === "proposed" && <StatusPill status="proposed" />}
    </li>
  );

  const updateItem = (v: (typeof view.updates)[number]) => {
    const u = v.update;
    const proposed = u.status === "proposed";
    const gone = u.status === "superseded" || u.status === "rejected" || u.status === "retconned";
    const others = v.entities.filter((e) => e.id !== page.id);
    return (
      <li
        key={u.id}
        className={`flex flex-col gap-2 rounded-[10px] sm:flex-row sm:items-start sm:gap-3 border px-3 py-2.5 ${proposed ? "border-warn-line bg-warn-tint" : "border-line"} ${gone ? "text-faint" : ""}`}
      >
        <details className="group min-w-0 flex-1">
          <summary className="flex cursor-pointer list-none flex-col gap-0.5 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-faint">
              <b className="text-[13px] text-ink">#{u.seq}</b>
              <StatusPill status={u.status} />
              <Severity severity={u.severity} />
              <span aria-hidden>·</span>
              <span>{u.type.replace(/-/g, " ")}</span>
              {u.chapter !== null && (
                <>
                  <span aria-hidden>·</span>
                  <span>{chapterTag(u.chapter)}</span>
                </>
              )}
              <span className="ml-auto text-accent group-open:hidden" aria-hidden>
                More
              </span>
            </span>
            <span className={`line-clamp-1 group-open:line-clamp-none ${gone ? "line-through" : ""}`}>{u.bodyMd}</span>
          </summary>
          <div className="mt-2">
            <UpdateItem
              layout="stack"
              hideBody
              head={
                others.length > 0 ? (
                  <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[12.5px]">
                    <span className="text-faint">Also touches</span>
                    {others.map((e) => (
                      <Link key={e.id} href={`${base}/e/${e.slug}`} className="text-accent-ink underline decoration-accent/30 underline-offset-2 hover:text-accent">
                        {e.name}
                      </Link>
                    ))}
                  </div>
                ) : null
              }
              body={u.bodyMd}
              foot={
                <>
                  <Knows v={v} />
                  <TagChips tags={extraTags(v)} />
                </>
              }
              {...(proposed && { edit: editProps(v, path) })}
            />
          </div>
        </details>
        {proposed && (
          <div className="flex shrink-0 gap-1.5">
            <ApproveButton v={v} path={path} />
            <RejectButton v={v} path={path} />
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="text-[13px] text-faint">
        <Link href={wiki} className="link">
          Wiki
        </Link>{" "}
        /{" "}
        <Link href={`${wiki}?type=${page.type}`} className="link">
          {TYPE_PLURAL[page.type]}
        </Link>{" "}
        / {page.name}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-[1_1_420px] flex-col gap-2.5">
          <h1 className="font-serif text-[40px] leading-[1.1] font-semibold">{page.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-accent-soft py-[3px] text-accent-ink">{TYPE_LABEL[page.type]}</span>
            {toPc && (
              <a href={`#s-${toPcSection?.id}`} className="pill bg-surface py-[3px] text-ink ring-1 ring-line-strong" aria-label={`To the PC: ${toPc}`}>
                To the PC: <b className="ml-1">{toPc}</b>
              </a>
            )}
            <SourcePill source={page.source} prefix />
            {page.campaignId && <span className="pill bg-sunken py-[3px] text-body">This campaign only</span>}
            <details className="group text-[13px] text-muted">
              <summary className="cursor-pointer list-none">
                {page.aliases.length ? <>Also called: {page.aliases.join(" · ")}</> : "No aliases"} <span className="link ml-1">Edit</span>
              </summary>
              <ActionForm action={editAliases} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="entityId" value={page.id} />
                <input type="hidden" name="path" value={path} />
                <input name="aliases" defaultValue={page.aliases.join(", ")} className="input max-w-md" placeholder="Comma-separated" aria-label="Aliases" />
                <button className="btn btn-sm">Save aliases</button>
              </ActionForm>
            </details>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="#add-section-heading" className="btn-primary">
            Add section
          </a>
        </div>
      </div>

      {page.status === "proposed" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-pending bg-surface px-5 py-3">
          <p className="font-semibold">Draft: the GM wrote this page and it waits for your approval. Until then the GM sees it labeled proposed.</p>
          <div className="flex gap-2">
            <ActionForm action={approvePage}>
              <input type="hidden" name="entityId" value={page.id} />
              <input type="hidden" name="path" value={path} />
              <button className="btn-primary btn-sm">Approve page</button>
            </ActionForm>
            <ActionForm action={rejectPage}>
              <input type="hidden" name="entityId" value={page.id} />
              <input type="hidden" name="path" value={path} />
              <input type="hidden" name="back" value={wiki} />
              <button className="btn btn-sm">Reject page</button>
            </ActionForm>
          </div>
        </div>
      )}

      {page.source === "unverified" && (
        <ActionForm action={markCanon} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-warn-dash bg-warn-tint px-5 py-3">
          <input type="hidden" name="entityId" value={page.id} />
          <input type="hidden" name="path" value={path} />
          <p className="font-semibold text-warn">Unverified: drafted from an established setting and not yet checked. The GM sees it labeled as such.</p>
          <button className="btn btn-sm">Checked: mark as canon</button>
        </ActionForm>
      )}

      <nav aria-label="Page views" className="-mb-2 flex gap-1 overflow-x-auto border-b border-line whitespace-nowrap">
        {tabs.map(([key, label, n, hot]) => (
          <Link
            key={key}
            href={key === "page" ? path : `${path}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px flex h-10 shrink-0 items-center gap-1.5 px-3 ${tab === key ? "border-b-2 border-accent font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            {label}
            {n !== undefined && n > 0 && <span className={`rounded-full px-1.5 text-xs ${hot ? "bg-pending font-bold text-[#1c1e21]" : "bg-sunken text-muted"}`}>{n}</span>}
          </Link>
        ))}
      </nav>

      {tab === "page" && (
        <>
          {menu.length > 3 && (
            <nav
              aria-label="On this page"
              className="-mt-2 flex items-center gap-x-1 overflow-x-auto border-y border-line-soft py-2 text-[13px] whitespace-nowrap sm:flex-wrap sm:whitespace-normal"
            >
              <span className="mr-1 shrink-0 text-faint">On this page</span>
              {menu.map(([label, id]) => (
                <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-sunken hover:text-ink">
                  {label}
                </a>
              ))}
            </nav>
          )}

          <div className="flex flex-wrap items-start gap-6">
            <article className="flex min-w-0 flex-[2_1_480px] flex-col gap-4">
              <InlineEditor
                action={editSummary}
                body={page.summary}
                hidden={hidden}
                label="summary"
                context={`${page.name} · Current state`}
                labelledBy="summary-h"
                title={
                  <h2 id="summary-h" className="label">
                    Current state
                  </h2>
                }
                meta={<span className="text-xs text-faint">What the GM reads first</span>}
              >
                <Markdown>{page.summary}</Markdown>
              </InlineEditor>

              {profile.pcSheet && (
                <section className="card flex flex-col gap-3" aria-labelledby="sheet-h">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="sheet-h" className={TITLE}>
                      Character sheet
                    </h2>
                    <span className="text-xs text-faint">Player character · kept by the GM</span>
                  </div>
                  <PcSheetBody data={profile.pcSheet.data as Record<string, unknown>} showName={false} showInventory={false} />
                </section>
              )}

              {profile.outline.map((o) => {
                if (o.sectionId === "hidden") return null;
                const extra = recorded(o.key);
                const sec = o.sectionId ? page.sections.find((x) => x.id === o.sectionId) : undefined;
                if (sec && sec === toPcSection && toPc) return null;
                if (sec) return sectionCard(sec, extra);
                if (!extra) return null;
                return (
                  <InlineEditor
                    key={o.key}
                    action={addSection}
                    body=""
                    hidden={{ ...hidden, heading: o.heading }}
                    label={`section ${o.heading}`}
                    editText="Write"
                    context={`${page.name} · ${o.heading}`}
                    labelledBy={`slot-${o.key}`}
                    className="rounded-xl border border-dashed border-line-strong px-6 py-5"
                    title={
                      <h2 id={`slot-${o.key}`} className={`${TITLE} text-muted`}>
                        {o.heading}
                      </h2>
                    }
                    meta={<span className="text-xs text-faint">Not written yet</span>}
                  >
                    {extra}
                  </InlineEditor>
                );
              })}

              {page.sections.filter((x) => !outlineKeys.has(x.key)).map((x) => sectionCard(x, null))}

              {emptySlots.length > 0 && <EmptySlots action={addSection} slots={emptySlots} />}

              <details id="add-section" className="group rounded-xl border border-dashed border-line-strong px-6 py-4 open:border-solid open:border-line open:bg-surface">
                <summary className="cursor-pointer list-none text-[15px] font-semibold text-accent hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                  <span className="group-open:text-ink">+ Add a section</span>
                </summary>
                <ConfirmedForm
                  action={addSection}
                  hidden={hidden}
                  submit="Add section"
                  trigger="Add section"
                  triggerClass="btn-primary btn-sm mt-3"
                  context={`${page.name} · new section`}
                  note="The new section is locked against GM edits, and the GM sees it at the start of the next session."
                >
                  <div className="mt-3 grid gap-2">
                    <input id="add-section-heading" name="heading" placeholder="Heading" className="input scroll-mt-24" aria-label="New section heading" required />
                    <textarea name="body" rows={4} placeholder="Markdown" className="input font-serif text-base" aria-label="New section body" />
                    <label className="flex items-center gap-2 text-[13px] text-muted">
                      <input type="checkbox" name="visibility" value="secret" className="accent-accent" /> Secret (hidden in player view)
                    </label>
                  </div>
                </ConfirmedForm>
              </details>
            </article>

            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
              {toPcSection && toPc && sectionCard(toPcSection, null, true)}
              {scope.campaign && (
                <section className="card-sm flex flex-col gap-2.5">
                  <h2 className="text-[15px] font-semibold">Appearances</h2>
                  {profile.scenes.length === 0 ? (
                    <p className="text-[13px] text-faint">Not in any logged scene yet.</p>
                  ) : (
                    <ol className="flex flex-col gap-2.5 text-[13px]">
                      {profile.scenes.map((sc) => (
                        <li key={sc.id}>
                          <b>
                            {chapterTag(sc.chapter)} · scene {sc.number}
                          </b>
                          {sc.place && sc.place.id !== page.id && (
                            <>
                              {" "}
                              at{" "}
                              <Link href={`${base}/e/${sc.place.slug}`} className="link">
                                {sc.place.name}
                              </Link>
                            </>
                          )}
                          {sc.summaryMd && <p className="mt-0.5 line-clamp-3 font-serif text-sm text-muted">{sc.summaryMd}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}

              {profile.threads.length > 0 && (
                <section className="card-sm flex flex-col gap-2.5">
                  <h2 className="text-[15px] font-semibold">Threads</h2>
                  {profile.threads.map((t) => (
                    <div key={t.id} className={`border-l-[3px] pl-2.5 text-[13px] ${t.state === "open" ? "border-pending" : "border-line-strong text-faint"}`}>
                      <b>{t.title}</b>
                      <div className="text-faint">
                        {t.state === "open" ? "Open" : "Resolved"}
                        {t.openedChapter !== null && <> · opened {chapterTag(t.openedChapter)}</>}
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </aside>
          </div>
        </>
      )}

      {tab === "updates" && scope.campaign && (
        <div className="max-w-3xl">
          <section className="card flex flex-col gap-3" aria-labelledby="updates-h">
            <h2 id="updates-h" className="sr-only">
              Updates to this page
            </h2>
            {view.updates.length === 0 && <p className="text-muted">None yet.</p>}
            <ul className="flex flex-col gap-2">{view.updates.map((v) => updateItem(v))}</ul>
          </section>
        </div>
      )}

      {tab === "knows" && scope.campaign && (
        <div className="max-w-3xl">
          <section className="card flex flex-col gap-3" aria-labelledby="knows-h">
            <div className="flex items-center justify-between gap-3">
              <h2 id="knows-h" className="sr-only">
                What {page.name} knows
              </h2>
            </div>
            {profile.knows.length === 0 ? <p className="text-faint">Nothing recorded yet.</p> : <ul className="flex flex-col gap-3">{knowsNewest.map((u) => knowItem(u))}</ul>}
          </section>
        </div>
      )}

      {tab === "history" && (
        <div className="max-w-3xl">
          <section id="history" className="card flex flex-col gap-3" aria-labelledby="history-h">
            <h2 id="history-h" className="sr-only">
              History
            </h2>
            <ol className="flex flex-col gap-3 text-[13px]">
              {view.history.map((v) => {
                const restorable = v.before !== null && v.after !== null;
                const name = v.label === "Page" ? `${page.name} · page` : `${page.name} · ${v.label.replace(/^Section "(.*)"$/, "$1")}`;
                return (
                  <li key={v.id}>
                    <div>
                      <b>{v.author === "user" ? "You" : "GM"}</b> {historyLine(v)}{" "}
                      {v.editKind && (
                        <span className="pill bg-accent-soft px-2 py-px font-normal text-accent-ink">{v.editKind === "retcon" ? "Retcon" : "Change from now on"}</span>
                      )}
                    </div>
                    <div className="text-faint">
                      <time dateTime={v.createdAt} title={new Date(v.createdAt).toLocaleString("en-US")}>
                        {ago(v.createdAt)}
                      </time>
                    </div>
                    {stateText(v.after) && <p className="mt-1 line-clamp-2 font-serif text-sm text-muted">{stateText(v.after)}</p>}
                    {restorable && (
                      <div className="mt-1 flex flex-wrap gap-x-1">
                        <ConfirmedForm
                          action={restoreVersion}
                          hidden={{ versionId: v.id, side: "before", path }}
                          submit="Undo change"
                          trigger="Undo this change"
                          context={name}
                          before={stateText(v.after)}
                          after={stateText(v.before)}
                          note="The undo is itself a new version, so you can redo it from here."
                          triggerClass="btn-ghost -ml-2"
                        />
                        <ConfirmedForm
                          action={restoreVersion}
                          hidden={{ versionId: v.id, side: "after", path }}
                          submit="Restore version"
                          trigger="Restore this version"
                          context={name}
                          after={stateText(v.after)}
                          note="The restore is itself a new version, so nothing is lost."
                          triggerClass="btn-ghost"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}
