"use client";
import { useState } from "react";

type Theme = "light" | "dark" | "system";

/** Light / Dark / System, kept in a cookie and applied as data-theme on <html> (UX review #33). */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const pick = (t: Theme) => {
    setTheme(t);
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <div role="radiogroup" aria-label="Theme" className="mx-3 my-1 flex gap-0.5 rounded-lg bg-nav-active p-0.5 text-xs">
      {(["light", "dark", "system"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => pick(t)}
          className={`flex-1 rounded-md px-2 py-1.5 capitalize ${theme === t ? "bg-nav font-semibold text-white" : "text-nav-muted hover:text-white"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
