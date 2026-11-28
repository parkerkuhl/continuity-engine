"use client";
import { useEffect } from "react";

/**
 * `/` or Ctrl/⌘+K focuses the search box on any screen (the top bar's, or the wiki's own on the wiki screen),
 * unless the user is already typing somewhere.
 */
export function SearchShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (e.key !== "/" && !k) return;
      const a = document.activeElement as HTMLElement | null;
      if (!k && a && (a.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      const box = [...document.querySelectorAll<HTMLInputElement>('input[type="search"]')].find((x) => x.offsetParent !== null);
      if (!box) return;
      e.preventDefault();
      box.focus();
      box.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
