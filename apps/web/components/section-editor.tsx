"use client";
import { useState, type ReactNode } from "react";
import type { ActionState } from "./action-form";
import { ActionForm } from "./action-form";
import { EditConfirm } from "./edit-confirm";

type Action = (prev: ActionState, f: FormData) => Promise<ActionState>;

/**
 * Inline editing of one block of Markdown (a section body or the summary). Saving opens the
 * edit-confirm step, because every change to what the wiki says needs an edit kind.
 */
export function InlineEditor({
  action,
  body,
  hidden,
  children,
  label,
}: {
  action: Action;
  body: string;
  hidden: Record<string, string>;
  children: ReactNode;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<string | undefined>();
  if (!editing) {
    return (
      <div className="group relative">
        {children}
        {flash && (
          <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            {flash}
          </p>
        )}
        <button type="button" onClick={() => { setDraft(body); setFlash(undefined); setEditing(true); }} className="btn mt-2 text-xs" aria-label={`Edit ${label}`}>
          Edit
        </button>
      </div>
    );
  }
  return (
    <ActionForm action={async (prev, f) => {
      const r = await action(prev, f);
      if (r.ok) { setEditing(false); setConfirming(false); setFlash(r.ok); }
      return r;
    }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <textarea
        name="body"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.min(18, Math.max(4, draft.split("\n").length + 1))}
        aria-label={label}
        className="w-full rounded-md border border-stone-300 bg-white p-3 font-serif text-[17px] leading-relaxed dark:border-stone-600 dark:bg-stone-900"
      />
      <p className="mt-1 text-xs text-stone-500">Markdown. Use ### or deeper for headings inside a section.</p>
      {confirming ? (
        <EditConfirm onCancel={() => setConfirming(false)} />
      ) : (
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primary" disabled={draft === body} onClick={() => setConfirming(true)}>Save</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}
    </ActionForm>
  );
}

/** A form whose submit opens the edit-confirm step first (restore, add section). */
export function ConfirmedForm({ action, hidden, children, verb, trigger }: { action: Action; hidden: Record<string, string>; children?: ReactNode; verb: string; trigger: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <ActionForm action={async (prev, f) => {
      const r = await action(prev, f);
      if (r.ok) setConfirming(false);
      return r;
    }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {confirming ? <EditConfirm verb={verb} onCancel={() => setConfirming(false)} /> : (
        <button type="button" className="btn text-xs" onClick={() => setConfirming(true)}>{trigger}</button>
      )}
    </ActionForm>
  );
}
