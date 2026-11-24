"use client";
import { useCallback, useState, type ReactNode } from "react";
import type { ActionState } from "./action-form";
import { ActionForm } from "./action-form";
import { EditConfirm } from "./edit-confirm";

type Action = (prev: ActionState, f: FormData) => Promise<ActionState>;

/**
 * One editable block of Markdown (a section body or the summary), drawn as its card. Saving opens
 * the edit-confirm dialog, because every change to what the wiki says needs an edit kind.
 */
export function InlineEditor({
  action,
  body,
  hidden,
  children,
  label,
  title,
  meta,
  context,
  className = "card",
  labelledBy,
  editText = "Edit",
}: {
  action: Action;
  body: string;
  hidden: Record<string, string>;
  children: ReactNode;
  /** Accessible name of the text box; the Edit button is "Edit <label>". */
  label: string;
  title: ReactNode;
  meta?: ReactNode;
  /** Shown under the dialog title, e.g. "Rickard Snow · Wants". */
  context: string;
  className?: string;
  labelledBy?: string;
  /** The edit button's text ("Write" for an empty outline slot). */
  editText?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<string | undefined>();
  const cancelConfirm = useCallback(() => setConfirming(false), []);
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {title}
      <div className="flex flex-wrap items-center gap-2">
        {meta}
        {!editing && (
          <button type="button" onClick={() => { setDraft(body); setFlash(undefined); setEditing(true); }} className="btn-ghost" aria-label={`Edit ${label}`}>
            {editText}
          </button>
        )}
      </div>
    </div>
  );
  return (
    <section className={className} aria-labelledby={labelledBy}>
      {head}
      {!editing ? (
        <div className="mt-2.5">
          {children}
          {flash && (
            <p role="status" className="mt-3 text-[13px] text-ok">
              {flash}
            </p>
          )}
        </div>
      ) : (
        <ActionForm
          className="mt-2.5"
          action={async (prev, f) => {
            const r = await action(prev, f);
            if (r.ok) { setEditing(false); setConfirming(false); setFlash(r.ok); }
            return r;
          }}
        >
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <textarea
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(18, Math.max(4, draft.split("\n").length + 1))}
            aria-label={label}
            className="w-full rounded-lg border border-line-strong bg-surface p-3 font-serif text-[17px] leading-[1.6] focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-xs text-faint">Markdown. Use ### or deeper for headings inside a section.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={draft === body} onClick={() => setConfirming(true)}>Save</button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          {confirming && <EditConfirm onCancel={cancelConfirm} context={context} before={body} after={draft} />}
        </ActionForm>
      )}
    </section>
  );
}

/** A form whose submit opens the edit-confirm dialog first (restore, undo, add section). */
export function ConfirmedForm({
  action,
  hidden,
  children,
  submit,
  trigger,
  context,
  before,
  after,
  note,
  triggerClass = "btn-ghost",
  className,
}: {
  action: Action;
  hidden: Record<string, string>;
  children?: ReactNode;
  submit: string;
  trigger: string;
  context?: string;
  before?: string;
  after?: string;
  note?: string;
  triggerClass?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const cancel = useCallback(() => setConfirming(false), []);
  return (
    <ActionForm
      className={className}
      action={async (prev, f) => {
        const r = await action(prev, f);
        if (r.ok) setConfirming(false);
        return r;
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <button type="button" className={triggerClass} onClick={() => setConfirming(true)}>{trigger}</button>
      {confirming && (
        <EditConfirm onCancel={cancel} submit={submit} {...(context && { context })} {...(before !== undefined && { before })} {...(after !== undefined && { after })} {...(note !== undefined && { note })} />
      )}
    </ActionForm>
  );
}
