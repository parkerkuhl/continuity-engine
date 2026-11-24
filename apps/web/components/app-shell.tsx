import Link from "next/link";
import type { ReactNode } from "react";
import type { Scope } from "@continuity/core";
import { setCampaignSpoilers, setWorldSpoilers } from "@/app/actions";
import { app, isRemote } from "@/lib/server";
import { AutoRefresh } from "./auto-refresh";
import { LockIcon } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { HeaderSearch, NavLink } from "./nav-link";

/**
 * Every screen sits in this shell: the dark sidebar (where you are, and where you can go) and,
 * on world and campaign screens, the top bar with search and the spoiler toggle (default off).
 */
export async function AppShell({ scope, children }: { scope?: Scope; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <AutoRefresh everyMs={Number(process.env.CONTINUITY_REFRESH_MS) || 10_000} />
      <Sidebar scope={scope} />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        {scope && <TopBar scope={scope} />}
        <main className="mx-auto box-border flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-7 pb-12 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

/** The review count. Red when a conflict is waiting, since that is the one item that needs a decision. */
function Badge({ n, conflict }: { n: number; conflict?: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={`rounded-full px-2 py-px text-xs font-bold ${conflict ? "bg-danger-line text-white" : "bg-pending text-[#1c1e21]"}`}
      {...(conflict && { title: "Includes a conflict" })}
    >
      {n}
    </span>
  );
}

async function Sidebar({ scope }: { scope?: Scope }) {
  const c = scope?.campaign ?? null;
  const base = c ? `/c/${c.id}` : scope ? `/w/${scope.world.id}` : "/";
  let nav: ReactNode;
  if (c) {
    const views = (await app()).views;
    const [d, queue, pages] = await Promise.all([views.dashboard(scope!), views.reviewQueue(scope!), views.pageQueue(scope!)]);
    const waiting = queue.items.length + pages.length;
    nav = (
      <>
        <NavLink href={`${base}/wiki`} also={`${base}/e/`}>
          Wiki
        </NavLink>
        <NavLink href={`${base}/review`}>
          Review queue
          <Badge n={waiting} conflict={queue.items.some((i) => !!i.update.conflictsWith)} />
        </NavLink>
        <NavLink href={`${base}#threads`}>
          Threads <span className="text-xs text-nav-muted">{d!.openThreads.length} open</span>
        </NavLink>
        <NavLink href={`${base}#rulings`}>
          Rulings <span className="text-xs text-nav-muted">{d!.rulings.length}</span>
        </NavLink>
        <NavLink href={`${base}#chapters`}>Chapters</NavLink>
        <NavLink href={`${base}#voice`}>Voice</NavLink>
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
    const row = (await (await app()).views.home()).find((r) => r.world.id === scope.world.id);
    const pages = await (await app()).views.pageQueue(scope);
    nav = (
      <>
        <NavLink href={base} exact also={`${base}/e/`}>
          Wiki
        </NavLink>
        <NavLink href={`${base}/review`}>
          Review queue
          <Badge n={pages.length} />
        </NavLink>
        {row?.campaigns.map((x) => (
          <NavLink key={x.id} href={`/c/${x.id}`}>
            {x.name} <span className="text-xs text-nav-muted">ch {x.currentChapter}</span>
          </NavLink>
        ))}
      </>
    );
  } else {
    const rows = await (await app()).views.home();
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
    <nav aria-label="Main" className="box-border flex max-w-full flex-[1_1_232px] flex-col gap-4 bg-nav px-4 py-3 text-nav-strong sm:max-w-[280px] sm:gap-6 sm:py-5">
      <MobileMenu
        label={c?.name ?? scope?.world.name}
        brand={
          <Link href="/" className="px-2 py-1 text-[15px] font-bold tracking-[0.2px] text-nav-strong">
            Continuity Engine
          </Link>
        }
      >
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
        {isRemote() && (
          <form action="/auth/signout" method="post" className={scope ? "flex flex-col" : "mt-auto flex flex-col border-t border-nav-line pt-4"}>
            <button className="px-3 py-2 text-left text-nav-muted hover:text-white">Sign out</button>
          </form>
        )}
      </MobileMenu>
    </nav>
  );
}

function TopBar({ scope }: { scope: Scope }) {
  const c = scope.campaign;
  const wiki = c ? `/c/${c.id}/wiki` : `/w/${scope.world.id}`;
  const on = scope.spoilers;
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:gap-4 sm:px-8 sm:py-3.5">
      <HeaderSearch action={wiki} wikiPaths={[wiki]} />
      <form action={c ? setCampaignSpoilers : setWorldSpoilers} className="ml-auto shrink-0">
        {c && <input type="hidden" name="campaignId" value={c.id} />}
        <input type="hidden" name="on" value={on ? "0" : "1"} />
        <button type="submit" role="switch" aria-checked={on} aria-label="GM spoilers" className="flex items-center gap-1 rounded-[10px] bg-sunken p-1">
          <span className={`flex h-9 items-center rounded-lg px-3 sm:px-3.5 ${on ? "font-medium text-muted" : "bg-surface font-semibold text-ink shadow-sm"}`}>
            Player<span className="hidden sm:inline">&nbsp;view</span>
          </span>
          <span className={`flex h-9 items-center rounded-lg px-3 sm:px-3.5 ${on ? "bg-[#4a3389] font-semibold text-white" : "font-medium text-muted"}`}>
            GM<span className="hidden sm:inline">&nbsp;view · spoilers</span>
          </span>
        </button>
      </form>
    </header>
  );
}
