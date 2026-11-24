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
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          {state.ok}
        </p>
      )}
    </form>
  );
}
