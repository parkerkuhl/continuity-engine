"use client";
import { useState } from "react";

/** Copies a short text (a prompt to paste into Claude) and says so for a moment. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
