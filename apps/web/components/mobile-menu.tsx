"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * On phones the sidebar collapses to its brand row and a Menu button, so each screen starts with its
 * own content instead of a full screen of navigation. From the sm breakpoint up it always shows.
 */
export function MobileMenu({ brand, label, children }: { brand: ReactNode; label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {brand}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="main-menu"
          onClick={() => setOpen((x) => !x)}
          className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-nav-line px-3 text-[13px] text-nav-text sm:hidden"
        >
          {label && <span className="truncate text-nav-muted">{label}</span>}
          <span className="shrink-0 font-semibold">{open ? "Close" : "Menu"}</span>
        </button>
      </div>
      <div id="main-menu" className={`${open ? "flex" : "hidden"} flex-1 flex-col gap-6 sm:flex`}>
        {children}
      </div>
    </>
  );
}
