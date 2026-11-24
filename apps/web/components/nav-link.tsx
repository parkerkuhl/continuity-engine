"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A sidebar link that shows itself as current. `exact` matches only its own path, not the paths under it. */
export function NavLink({ href, exact, also, children }: { href: string; exact?: boolean; also?: string; children: ReactNode }) {
  const path = usePathname();
  const bare = href.split("#")[0]!;
  const current = !href.includes("#") && ((exact ? path === bare : path === bare || path.startsWith(`${bare}/`)) || (!!also && path.startsWith(also)));
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 ${current ? "bg-nav-active font-semibold text-white" : "text-nav-text hover:bg-nav-active/60 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

/** The top bar's search. The wiki screen has its own large search box, so this one steps aside there. */
export function HeaderSearch({ action, wikiPaths }: { action: string; wikiPaths: string[] }) {
  const path = usePathname();
  if (wikiPaths.includes(path)) return <div className="flex-1" />;
  return (
    <form
      action={action}
      role="search"
      className="flex h-10 min-w-0 max-w-[520px] flex-[1_1_160px] sm:flex-[1_1_280px] items-center gap-2 rounded-lg border border-line-strong bg-surface px-3"
    >
      <SearchGlyph />
      <input
        type="search"
        name="q"
        placeholder="Search names, aliases, places…"
        aria-label="Search the wiki"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
      />
    </form>
  );
}

export function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-faint">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
