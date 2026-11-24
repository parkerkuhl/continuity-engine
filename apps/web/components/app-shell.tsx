import Link from "next/link";
import type { ReactNode } from "react";
import type { Scope } from "@continuity/core";
import { setCampaignSpoilers, setWorldSpoilers } from "@/app/actions";
import { app } from "@/lib/server";
import { LockIcon } from "./icons";
import { HeaderSearch, NavLink } from "./nav-link";

/**
 * Every screen sits in this shell: the dark sidebar (where you are, and where you can go) and,
 * on world and campaign screens, the top bar with search and the spoiler toggle (default off).
 */
export async function AppShell({ scope, children }: { scope?: Scope; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <Sidebar scope={scope} />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        {scope && <TopBar scope={scope} />}
        <main className="box-border flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-7 pb-12 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

async function Sidebar({ scope }: { scope?: Scope }) {
  const c = scope?.campaign ?? null;
  const base = c ? `/c/${c.id}` : scope ? `/w/${scope.world.id}` : "/";
  let nav: ReactNode;
  if (c) {
    const views = app().views;
    const [d, queue] = await Promise.all([views.dashboard(scope!), views.reviewQueue(scope!)]);
    nav = (
      <>
        <NavLink href={`${base}/wiki`} also={`${base}/e/`}>
          Wiki
        </NavLink>
        <NavLink href={`${base}/review`}>
          Review queue
          {queue.items.length > 0 && <span className="rounded-full bg-pending px-2 py-px text-xs font-bold text-[#1c1e21]">{queue.items.length}</span>}
        </NavLink>
        <NavLink href={`${base}#threads`}>
          Threads <span className="text-xs text-nav-muted">{d!.openThreads.length} open</span>
        </NavLink>
        <NavLink href={`${base}#rulings`}>
          Rulings <span className="text-xs text-nav-muted">{d!.rulings.length}</span>
        </NavLink>
        <NavLink href={`${base}#chapters`}>Chapters</NavLink>
        <NavLink href={base} exact>
          Campaign settings
        </NavLink>
        <NavLink href={`${base}/gm`}>
          GM notes
          {!scope!.spoilers && (
            <span role="img" aria-label="Hidden in player view" title="Hidden in player view" className="text-nav-muted">
              <LockIcon />
            </span>
          )}
        </NavLink>
      </>
    );
  } else if (scope) {
    const row = (await app().views.home()).find((r) => r.world.id === scope.world.id);
    nav = (
      <>
        <NavLink href={base} exact also={`${base}/e/`}>
          Wiki
        </NavLink>
        {row?.campaigns.map((x) => (
          <NavLink key={x.id} href={`/c/${x.id}`}>
            {x.name} <span className="text-xs text-nav-muted">ch {x.currentChapter}</span>
          </NavLink>
        ))}
      </>
    );
  } else {
    const rows = await app().views.home();
    nav = (
      <>
        <NavLink href="/" exact>
          All worlds
        </NavLink>
        {rows.map((r) => (
          <NavLink key={r.world.id} href={`/w/${r.world.id}`}>
            {r.world.name}
          </NavLink>
        ))}
      </>
    );
  }
  return (
    <nav aria-label="Main" className="box-border flex max-w-full flex-[1_1_232px] flex-col gap-6 bg-nav px-4 py-5 text-nav-strong sm:max-w-[280px]">
      <Link href="/" className="px-2 py-1 text-[15px] font-bold tracking-[0.2px] text-nav-strong">
        Continuity Engine
      </Link>
      {scope && (
        <div className="flex flex-col gap-0.5 rounded-[10px] border border-nav-line px-3 py-2.5">
          <span className="text-[11px] tracking-[0.8px] text-nav-muted uppercase">World</span>
          <span className="font-semibold">{scope.world.name}</span>
          {c && (
            <>
              <span className="mt-2 text-[11px] tracking-[0.8px] text-nav-muted uppercase">Campaign</span>
              <span className="font-semibold">{c.name}</span>
              <span className="text-xs text-nav-muted">
                Chapter {c.currentChapter}
                {c.asOfStoryTime && <> · {c.asOfStoryTime}</>}
              </span>
            </>
          )}
        </div>
      )}
      <div className="flex flex-col gap-0.5">{nav}</div>
      {scope && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-nav-line pt-4">
          <a href={`/w/${scope.world.id}/export`} className="px-3 py-2 text-nav-muted hover:text-white">
            Export as Markdown
          </a>
          <Link href="/" className="px-3 py-2 text-nav-muted hover:text-white">
            All worlds
          </Link>
        </div>
      )}
    </nav>
  );
}

function TopBar({ scope }: { scope: Scope }) {
  const c = scope.campaign;
  const wiki = c ? `/c/${c.id}/wiki` : `/w/${scope.world.id}`;
  const on = scope.spoilers;
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 py-3.5 sm:px-8">
      <HeaderSearch action={wiki} wikiPaths={[wiki]} />
      <form action={c ? setCampaignSpoilers : setWorldSpoilers} className="ml-auto">
        {c && <input type="hidden" name="campaignId" value={c.id} />}
        <input type="hidden" name="on" value={on ? "0" : "1"} />
        <button type="submit" role="switch" aria-checked={on} aria-label="GM spoilers" className="flex items-center gap-1 rounded-[10px] bg-sunken p-1">
          <span className={`flex h-9 items-center rounded-lg px-3.5 ${on ? "font-medium text-muted" : "bg-surface font-semibold text-ink shadow-sm"}`}>Player view</span>
          <span className={`flex h-9 items-center rounded-lg px-3.5 ${on ? "bg-[#4a3389] font-semibold text-white" : "font-medium text-muted"}`}>GM view · spoilers</span>
        </button>
      </form>
    </header>
  );
}
