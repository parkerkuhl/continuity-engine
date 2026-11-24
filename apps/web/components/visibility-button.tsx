"use client";
import { useState } from "react";
import { setSectionVisibility } from "@/app/actions";

/**
 * "Make secret" saves at once. "Make public" asks first, because one stray click would show the player
 * what the section hides.
 */
export function VisibilityButton({ hidden, secret, heading }: { hidden: Record<string, string>; secret: boolean; heading: string }) {
  const [asking, setAsking] = useState(false);
  const fields = (
    <>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="visibility" value={secret ? "public" : "secret"} />
    </>
  );
  if (!secret) {
    return (
      <form action={setSectionVisibility}>
        {fields}
        <button className="btn-ghost text-muted">Make secret</button>
      </form>
    );
  }
  if (!asking) {
    return (
      <button type="button" className="btn-ghost text-muted" onClick={() => setAsking(true)}>
        Make public
      </button>
    );
  }
  return (
    <form action={setSectionVisibility} role="group" aria-label={`Make ${heading} public?`} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-warn-tint px-2 py-1 text-[13px]">
      {fields}
      <span className="text-warn">The player will see “{heading}”.</span>
      <button className="btn-ghost">Make public</button>
      <button type="button" className="btn-ghost text-muted" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </form>
  );
}
