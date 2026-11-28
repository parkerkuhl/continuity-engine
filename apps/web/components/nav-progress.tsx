"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A 2px bar along the top while the app moves to another screen (UX review #31), so a slow query on the
 * hosted build never leaves the old page on screen with no sign that anything is happening.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [pathname, search]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.endsWith("/export")) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page or a #hash
      setBusy(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  if (!busy) return null;
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden">
      <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-accent" />
    </div>
  );
}
