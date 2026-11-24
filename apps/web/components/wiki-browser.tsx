import Link from "next/link";
import type { Entity, Scope } from "@continuity/core";
import { app, basePath } from "@/lib/server";
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

export async function WikiBrowser({ scope, query, source, type }: { scope: Scope; query?: string; source?: string; type?: string }) {
  const src = SOURCES.includes(source as Entity["source"]) ? (source as Entity["source"]) : undefined;
  const all = (await app().views.wiki(scope, { ...(query && { query }) })).flatMap((g) => g.entities);
  const typed = all.filter((r) => !type || r.entity.type === type);
  const shown = typed.filter((r) => !src || r.entity.source === src);
  const base = basePath(scope);
  const wiki = scope.campaign ? `${base}/wiki` : base;
  const href = (p: { type?: string | undefined; source?: string | undefined }) => {
    const q = new URLSearchParams();
    if (query) q.set("q", query);
    if (p.type) q.set("type", p.type);
    if (p.source) q.set("source", p.source);
    const s = q.toString();
    return `${wiki}${s ? `?${s}` : ""}`;
  };

  const pending = new Map<string, { proposed: number; conflict: boolean }>();
  for (const i of (await app().views.reviewQueue(scope)).items) {
    for (const e of i.entities) {
      const p = pending.get(e.id) ?? { proposed: 0, conflict: false };
      p.proposed++;
      if (i.update.conflictsWith) p.conflict = true;
      pending.set(e.id, p);
    }
  }
  const types = (Object.keys(TYPE_LABEL) as Entity["type"][]).map((t) => [t, all.filter((r) => r.entity.type === t).length] as const).filter(([, n]) => n > 0);
  const pc = scope.pc?.id;

  return (
    <>
      <form role="search" action={wiki} className="flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
        <SearchGlyph />
        <input type="search" name="q" defaultValue={query} placeholder="Search names, aliases, places…" aria-label="Search the wiki" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
        {type && <input type="hidden" name="type" value={type} />}
        {src && <input type="hidden" name="source" value={src} />}
        {query && (
          <Link href={href({ type, source: src })} className="link text-[13px]">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Type" className="flex flex-wrap gap-1 border-b border-line">
          <Tab href={href({ source: src })} on={!type}>
            All
          </Tab>
          {types.map(([t, n]) => (
            <Tab key={t} href={href({ type: t, source: src })} on={type === t}>
              {TYPE_PLURAL[t]} {n}
            </Tab>
          ))}
        </div>
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
      </div>

      {!scope.spoilers && query && <p className="-mt-2 text-xs text-faint">Player view: matches only in secret sections are left out.</p>}

      {shown.length === 0 ? (
        <p className="py-6 text-muted">{query || src || type ? "Nothing matches." : "No pages yet. The GM creates them during worldbuilding, or import a world from the home page."}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
          {shown
            .sort((a, b) => a.entity.name.localeCompare(b.entity.name))
            .map(({ entity: e, line }) => {
              const p = pending.get(e.id);
              const unverified = e.source === "unverified";
              return (
                <Link
                  key={e.id}
                  href={`${base}/e/${e.slug}`}
                  className={`flex flex-col gap-1.5 rounded-xl border px-[18px] py-4 text-ink hover:border-accent ${unverified ? "border-dashed border-warn-dash bg-warn-tint" : "border-line bg-surface"}`}
                >
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-muted">{TYPE_LABEL[e.type]}</span>
                    {p?.conflict ? (
                      <span className="rounded-full bg-danger-soft px-2 font-bold text-danger">Conflict</span>
                    ) : p ? (
                      <span className="rounded-full bg-pending px-2 font-bold text-[#1c1e21]">{p.proposed} proposed</span>
                    ) : null}
                  </div>
                  <b className="font-serif text-[19px] font-semibold">{e.name}</b>
                  {line && <span className="line-clamp-2 text-muted">{line}</span>}
                  <span className={`text-xs ${SOURCE_TEXT[e.source]}`}>
                    {SOURCE_LABEL[e.source]}
                    {unverified && " · confirm or correct"}
                    {e.id === pc && " · player character"}
                    {e.campaignId && " · this campaign"}
                  </span>
                </Link>
              );
            })}
        </div>
      )}
    </>
  );
}

function Tab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} role="tab" aria-selected={on} className={`-mb-px flex h-10 items-center px-3 ${on ? "border-b-2 border-accent font-semibold text-ink" : "text-muted hover:text-ink"}`}>
      {children}
    </Link>
  );
}

/** Header for a wiki screen: title, page count, and the world's export. */
export async function WikiHeader({ scope, title }: { scope: Scope; title: string }) {
  const n = (await app().views.wiki(scope)).reduce((sum, g) => sum + g.entities.length, 0);
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-1.5 text-muted">
          {n} page{n === 1 ? "" : "s"} · {scope.campaign ? "world canon plus this campaign's changes" : scope.world.pitch || "world canon"}
        </p>
      </div>
      <a href={`/w/${scope.world.id}/export`} className="btn">
        Export as Markdown
      </a>
    </div>
  );
}
