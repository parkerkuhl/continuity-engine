"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** True while the user is in the middle of something a refresh could disturb. */
function busy(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (a && (a.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName))) return true;
  if (document.querySelector('[role="dialog"], form[aria-busy="true"]')) return true;
  return !!window.getSelection()?.toString(); // don't drop a text selection
}

/**
 * Re-renders the current screen from the server every few seconds, so changes Claude makes while playing
 * (new updates in the review queue, pages, threads, the PC sheet) show up without a reload. It only runs while
 * the tab is visible, pauses while the user is typing, has a dialog open or a save in flight, and catches up
 * as soon as the tab comes back. Client state such as open editors and typed text survives a refresh.
 */
export function AutoRefresh({ everyMs = 10_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !busy()) router.refresh();
    };
    const id = window.setInterval(tick, everyMs);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [router, everyMs]);
  return null;
}
