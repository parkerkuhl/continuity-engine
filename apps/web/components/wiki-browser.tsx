import Link from "next/link";
import type { Entity, Scope } from "@continuity/core";
import { app, basePath } from "@/lib/server";

const TYPE_LABEL: Record<Entity["type"], string> = {
  character: "Characters",
  place: "Places",
  faction: "Factions",
  item: "Items",
  event: "Events",
  concept: "Setting",
  rule: "Rules",
};
const SOURCES: Entity["source"][] = ["canon", "ruling", "invention", "unverified"];

export function SourceBadge({ source }: { source: Entity["source"] }) {
  const style: Record<Entity["source"], string> = {
    canon: "border-stone-300 text-stone-600 dark:border-stone-600 dark:text-stone-300",
    ruling: "border-sky-300 text-sky-800 dark:border-sky-700 dark:text-sky-300",
    invention: "border-violet-300 text-violet-800 dark:border-violet-700 dark:text-violet-300",
    unverified: "border-amber-400 text-amber-800 dark:border-amber-600 dark:text-amber-300",
  };
  return <span className={`badge ${style[source]}`}>{source}</span>;
}

export async function WikiBrowser({ scope, query, source }: { scope: Scope; query?: string; source?: string }) {
  const src = SOURCES.includes(source as Entity["source"]) ? (source as Entity["source"]) : undefined;
  const groups = await app().views.wiki(scope, { ...(query && { query }), ...(src && { source: src }) });
  const base = basePath(scope);
  const href = (s?: string) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (s) p.set("source", s);
    const qs = p.toString();
    return `${base}${scope.campaign ? "/wiki" : ""}${qs ? `?${qs}` : ""}`;
  };
  return (
    <div>
      <form className="flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={query} placeholder="Search names, aliases, summaries and sections" className="input max-w-md" aria-label="Search the wiki" />
        {src && <input type="hidden" name="source" value={src} />}
        <button className="btn">Search</button>
        {query && (
          <Link href={href(src)} className="text-sm text-stone-500 underline">
            Clear
          </Link>
        )}
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="label">Source</span>
        <Link href={href()} className={`badge ${!src ? "border-stone-900 bg-stone-900 text-white dark:border-amber-200 dark:bg-amber-200 dark:text-stone-950" : "border-stone-300"}`}>
          all
        </Link>
        {SOURCES.map((s) => (
          <Link key={s} href={href(s)} className={`badge ${src === s ? "border-stone-900 bg-stone-900 text-white dark:border-amber-200 dark:bg-amber-200 dark:text-stone-950" : "border-stone-300"}`}>
            {s}
          </Link>
        ))}
      </div>
      {!scope.spoilers && query && <p className="mt-2 text-xs text-stone-500">Spoilers are off, so matches only in secret sections are left out.</p>}
      {groups.length === 0 ? (
        <p className="mt-8 text-stone-500">{query || src ? "Nothing matches." : "No pages yet. Claude creates them during worldbuilding, or import a world from the home page."}</p>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <section key={g.type} className="card">
              <h2 className="label mb-2">
                {TYPE_LABEL[g.type]} <span className="font-normal">({g.entities.length})</span>
              </h2>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {g.entities.map(({ entity, line }) => (
                  <li key={entity.id} className="py-2">
                    <div className="flex items-center gap-2">
                      <Link href={`${base}/e/${entity.slug}`} className="font-serif text-[17px] font-semibold hover:underline">
                        {entity.name}
                      </Link>
                      <SourceBadge source={entity.source} />
                      {entity.campaignId && <span className="badge border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300">campaign</span>}
                    </div>
                    {line && <p className="mt-0.5 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{line}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
