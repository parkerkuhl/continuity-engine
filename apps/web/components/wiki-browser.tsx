import Link from "next/link";
import type { Entity, Scope } from "@continuity/core";
import { app, basePath } from "@/lib/server";
import { setWorldAsOf } from "@/app/actions";
import { ActionForm } from "./action-form";
import { SearchGlyph } from "./nav-link";

export const TYPE_LABEL: Record<Entity["type"], string> = {
  character: "Character",
  place: "Place",
  faction: "Faction",
  item: "Item",
  event: "Event",
  concept: "Setting",
  rule: "Rule",
};
export const TYPE_PLURAL: Record<Entity["type"], string> = {
  character: "Characters",
  place: "Places",
  faction: "Factions",
  item: "Items",
  event: "Events",
  concept: "Setting",
  rule: "Rules",
};
const SOURCES: Entity["source"][] = ["canon", "ruling", "invention", "unverified"];
const SOURCE_LABEL: Record<Entity["source"], string> = { canon: "Canon", ruling: "Ruling", invention: "Invention", unverified: "Unverified" };
const SOURCE_TEXT: Record<Entity["source"], string> = { canon: "text-accent-ink", ruling: "text-accent-ink", invention: "text-secret", unverified: "text-warn font-semibold" };

export function SourcePill({ source, prefix }: { source: Entity["source"]; prefix?: boolean }) {
  const style: Record<Entity["source"], string> = {
    canon: "bg-accent-soft text-accent-ink",
    ruling: "bg-accent-soft text-accent-ink",
    invention: "bg-secret-soft text-secret",
    unverified: "border border-dashed border-warn-dash bg-warn-tint text-warn",
  };
  return <span className={`pill py-[3px] ${style[source]}`}>{prefix ? `Source: ${source}` : SOURCE_LABEL[source]}</span>;
}

export async function WikiBrowser({ scope, query, source, type, view }: { scope: Scope; query?: string; source?: string; type?: string; view?: string }) {
  const list = view === "list";
  const src = SOURCES.includes(source as Entity["source"]) ? (source as Entity["source"]) : undefined;
  const all = (await (await app()).views.wiki(scope, { ...(query && { query }) })).flatMap((g) => g.entities);
  const typed = all.filter((r) => !type || r.entity.type === type);
  const shown = typed.filter((r) => !src || r.entity.source === src);
  const base = basePath(scope);
  const wiki = scope.campaign ? `${base}/wiki` : base;
  const href = (p: { type?: string | undefined; source?: string | undefined; list?: boolean }) => {
    const q = new URLSearchParams();
    if (p.list ?? list) q.set("view", "list");
    if (query) q.set("q", query);
    if (p.type) q.set("type", p.type);
    if (p.source) q.set("source", p.source);
    const s = q.toString();
    return `${wiki}${s ? `?${s}` : ""}`;
  };

  const pending = new Map<string, { proposed: number; conflict: boolean }>();
  for (const i of (await (await app()).views.reviewQueue(scope)).items) {
    for (const e of i.entities) {
      const p = pending.get(e.id) ?? { proposed: 0, conflict: false };
      p.proposed++;
      if (i.update.conflictsWith) p.conflict = true;
      pending.set(e.id, p);
    }
  }
  const types = (Object.keys(TYPE_LABEL) as Entity["type"][]).map((t) => [t, all.filter((r) => r.entity.type === t).length] as const).filter(([, n]) => n > 0);
  const pc = scope.pc?.id;
  const npcs = scope.campaign ? all.filter((r) => r.entity.type === "character" && r.entity.id !== pc) : [];
  const characters = npcs.length;
  const unlabeled = npcs.filter((r) => !r.toPc).length;
  const sorted = [...shown].sort((a, b) => a.entity.name.localeCompare(b.entity.name));
  const groups = (Object.keys(TYPE_LABEL) as Entity["type"][]).map((t) => [t, sorted.filter((r) => r.entity.type === t)] as const).filter(([, rows]) => rows.length > 0);

  return (
    <>
      <form role="search" action={wiki} className="flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
        <SearchGlyph />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search names, aliases, places…"
          aria-label="Search the wiki"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        />
        {type && <input type="hidden" name="type" value={type} />}
        {src && <input type="hidden" name="source" value={src} />}
        {list && <input type="hidden" name="view" value="list" />}
        {query && (
          <Link href={href({ type, source: src })} className="link text-[13px]">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Type" className="flex max-w-full gap-1 overflow-x-auto border-b border-line whitespace-nowrap">
          <Tab href={href({ source: src })} on={!type}>
            All
          </Tab>
          {types.map(([t, n]) => (
            <Tab key={t} href={href({ type: t, source: src })} on={type === t}>
              {TYPE_PLURAL[t]} {n}
            </Tab>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Source" className="flex flex-wrap gap-1.5 text-[13px]">
            {SOURCES.map((s) => {
              const n = typed.filter((r) => r.entity.source === s).length;
              const on = src === s;
              const cls = on
                ? "bg-ink text-canvas font-semibold border-ink"
                : s === "unverified"
                  ? "border-dashed border-warn-dash bg-warn-tint text-warn font-semibold"
                  : "border-line-strong bg-surface text-ink";
              return (
                <Link key={s} href={href({ type, source: on ? undefined : s })} aria-pressed={on} className={`inline-flex h-8 items-center rounded-full border px-2.5 ${cls}`}>
                  {SOURCE_LABEL[s]} {n}
                </Link>
              );
            })}
          </div>
          <div role="group" aria-label="Layout" className="flex items-center gap-0.5 rounded-lg bg-sunken p-0.5 text-[13px]">
            <Link
              href={href({ type, source: src, list: false })}
              aria-pressed={!list}
              className={`flex h-7 items-center rounded-md px-2.5 ${!list ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              Cards
            </Link>
            <Link
              href={href({ type, source: src, list: true })}
              aria-pressed={list}
              className={`flex h-7 items-center rounded-md px-2.5 ${list ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              List
            </Link>
          </div>
        </div>
      </div>

      {!scope.spoilers && query && <p className="-mt-2 text-xs text-faint">Player view: search covers only what the PC knows.</p>}
      {unlabeled > 0 && (!type || type === "character") && (
        <p className="-mt-2 text-[13px] text-faint">
          {unlabeled} of {characters} characters have no “To the PC” label yet. The GM fills them in when the next chat opens the campaign.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-muted">
          {query || src || type ? "Nothing matches." : "No pages yet. The GM creates them during worldbuilding, or import a world from the home page."}
        </p>
      ) : (
        groups.map(([t, rows]) => (
          <section key={t} aria-labelledby={groups.length > 1 ? `g-${t}` : undefined} className="flex flex-col gap-3">
            {groups.length > 1 && (
              <h2 id={`g-${t}`} className="flex items-baseline gap-2 border-b border-line pb-1.5 font-serif text-xl font-semibold">
                {TYPE_PLURAL[t]} <span className="font-sans text-[13px] font-normal text-faint">{rows.length}</span>
              </h2>
            )}
            {list ? (
              <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface">
                {rows.map((r) => (
                  <li key={r.entity.id}>
                    <Row r={r} href={`${base}/e/${r.entity.slug}`} pending={pending.get(r.entity.id)} pc={pc} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
                {rows.map((r) => (
                  <WikiCard key={r.entity.id} r={r} href={`${base}/e/${r.entity.slug}`} pending={pending.get(r.entity.id)} pc={pc} grouped={groups.length > 1} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}

type WikiRow = { entity: Entity; line: string; toPc: string | null };
type Pending = { proposed: number; conflict: boolean } | undefined;

function Flag({ e, p }: { e: Entity; p: Pending }) {
  if (e.status === "proposed") return <span className="rounded-full bg-pending px-2 text-xs font-bold text-[#1c1e21]">Draft</span>;
  if (p?.conflict) return <span className="rounded-full bg-danger-soft px-2 text-xs font-bold text-danger">Conflict</span>;
  if (p) return <span className="rounded-full bg-pending px-2 text-xs font-bold text-[#1c1e21]">{p.proposed} proposed</span>;
  return null;
}

function SourceLine({ e, pc }: { e: Entity; pc: string | undefined }) {
  return (
    <span className={`text-xs ${SOURCE_TEXT[e.source]}`}>
      {SOURCE_LABEL[e.source]}
      {e.source === "unverified" && " · confirm or correct"}
      {e.id === pc && " · player character"}
      {e.campaignId && " · this campaign"}
    </span>
  );
}

function ToPc({ label }: { label: string }) {
  return (
    <span className="pill self-start bg-accent-soft py-[2px] text-[12px] text-accent-ink" title="Who they are to the player character">
      {label}
    </span>
  );
}

function WikiCard({ r, href, pending, pc, grouped }: { r: WikiRow; href: string; pending: Pending; pc: string | undefined; grouped: boolean }) {
  const { entity: e, line, toPc } = r;
  const unverified = e.source === "unverified";
  const flagged = e.status === "proposed" || !!pending;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1.5 rounded-xl border px-[18px] py-4 text-ink hover:border-accent ${unverified ? "border-dashed border-warn-dash bg-warn-tint" : "border-line bg-surface"}`}
    >
      {(!grouped || flagged) && (
        <div className="flex justify-between gap-2 text-xs">
          <span className="text-muted">{grouped ? "" : TYPE_LABEL[e.type]}</span>
          <Flag e={e} p={pending} />
        </div>
      )}
      <b className="font-serif text-[19px] leading-snug font-semibold">{e.name}</b>
      {toPc && <ToPc label={toPc} />}
      {line && <span className="line-clamp-2 text-muted">{line}</span>}
      <span className="mt-auto pt-0.5">
        <SourceLine e={e} pc={pc} />
      </span>
    </Link>
  );
}

function Row({ r, href, pending, pc }: { r: WikiRow; href: string; pending: Pending; pc: string | undefined }) {
  const { entity: e, line, toPc } = r;
  return (
    <Link
      href={href}
      className={`grid gap-x-4 gap-y-0.5 px-4 py-2.5 hover:bg-subtle sm:grid-cols-[minmax(180px,240px)_1fr_auto] sm:items-baseline ${e.source === "unverified" ? "bg-warn-tint" : ""}`}
    >
      <span className="flex flex-wrap items-baseline gap-2">
        <b className="font-serif text-[16px] font-semibold text-ink">{e.name}</b>
        {toPc && <span className="text-[12px] text-accent-ink">{toPc}</span>}
      </span>
      <span className="truncate text-muted">{line}</span>
      <span className="flex items-center gap-2 sm:justify-end">
        <Flag e={e} p={pending} />
        <SourceLine e={e} pc={pc} />
      </span>
    </Link>
  );
}

function Tab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={on}
      className={`-mb-px flex h-10 items-center px-3 ${on ? "border-b-2 border-accent font-semibold text-ink" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}

/** Header for a wiki screen: title, page count, and the world's export. */
export async function WikiHeader({ scope, title }: { scope: Scope; title: string }) {
  const n = (await (await app()).views.wiki(scope)).reduce((sum, g) => sum + g.entities.length, 0);
  const w = scope.world;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-1.5 text-muted">
          {n} page{n === 1 ? "" : "s"} · {scope.campaign ? "world canon plus this campaign's changes" : w.pitch || "world canon"}
        </p>
        {!scope.campaign && (
          <details className="mt-1 text-[13px] text-muted">
            <summary className="cursor-pointer">
              As of: <span className="text-ink">{w.asOfStoryTime ?? "not set"}</span> <span className="link">Change</span>
            </summary>
            <ActionForm action={setWorldAsOf} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="worldId" value={w.id} />
              <input type="hidden" name="path" value={`/w/${w.id}`} />
              <input name="asOf" defaultValue={w.asOfStoryTime ?? ""} className="input max-w-md" placeholder="When the story starts" aria-label="As-of moment" />
              <button className="btn btn-sm">Save as-of moment</button>
            </ActionForm>
            <p className="mt-1">New campaigns start at this moment.</p>
          </details>
        )}
      </div>
      <a href={`/w/${scope.world.id}/export`} className="btn">
        Export as Markdown
      </a>
    </div>
  );
}
