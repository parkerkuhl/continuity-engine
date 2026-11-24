"use client";
import { useActionState, type ReactNode } from "react";

export type ActionState = { ok?: string; error?: string; at?: number };
type Action = (prev: ActionState, f: FormData) => Promise<ActionState>;

/** A form bound to a server action, showing the engine's refusal or confirmation under it. */
export function ActionForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      {children}
      {state.error && (
        <p role="alert" className="mt-2 basis-full rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="mt-2 basis-full text-[13px] text-ok">
          {state.ok}
        </p>
      )}
    </form>
  );
}
