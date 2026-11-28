"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  startEditing = false,
  onCancel,
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
  /** Open with the text box showing (a slot the user just chose to write). */
  startEditing?: boolean;
  /** Called after Cancel, so a parent can close what it opened. */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(body);
  // The stored text when editing started: sent with the save, so a GM change in between is caught (UX review #18).
  const [base, setBase] = useState(body);
  const [conflict, setConflict] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<string | undefined>();
  const cancelConfirm = useCallback(() => setConfirming(false), []);
  // UX review #19: an unsaved draft survives navigation and reloads in this tab.
  const storeKey = `ce-draft:${hidden.entityId ?? ""}:${hidden.campaignId ?? ""}:${hidden.key ?? hidden.heading ?? label}`;
  const dirty = editing && draft !== base;
  const forget = useCallback(() => {
    try {
      sessionStorage.removeItem(storeKey);
    } catch {}
  }, [storeKey]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "null") as { draft: string; base: string } | null;
      if (saved && typeof saved.draft === "string" && saved.draft !== body) {
        setDraft(saved.draft);
        setBase(typeof saved.base === "string" ? saved.base : body);
        setEditing(true);
        setFlash("Draft restored");
      }
    } catch {}
    // Only on mount: later body changes must not overwrite what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);
  useEffect(() => {
    if (!editing) return;
    try {
      if (draft !== base) sessionStorage.setItem(storeKey, JSON.stringify({ draft, base }));
      else sessionStorage.removeItem(storeKey);
    } catch {}
  }, [editing, draft, base, storeKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const start = () => {
    setDraft(body);
    setBase(body);
    setFlash(undefined);
    setConflict(false);
    setEditing(true);
  };
  const save = () => {
    if (body !== base) setConflict(true);
    else setConfirming(true);
  };
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {title}
      <div className="flex flex-wrap items-center gap-2">
        {meta}
        {!editing && (
          <button type="button" onClick={start} className="btn-ghost" aria-label={`Edit ${label}`}>
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
            if (r.ok) {
              forget();
              setEditing(false);
              setConfirming(false);
              setFlash(r.ok);
            } else if (r.stale) {
              setConfirming(false);
              setConflict(true);
              router.refresh();
            }
            return r;
          }}
        >
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name="expected" value={base} />
          {flash === "Draft restored" && (
            <p role="status" className="mb-2 text-[13px] text-accent-ink">
              Draft restored: you hadn&apos;t saved this yet.
            </p>
          )}
          <textarea
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(18, Math.max(4, draft.split("\n").length + 1))}
            aria-label={label}
            className="w-full rounded-lg border border-line-strong bg-surface p-3 font-serif text-[17px] leading-[1.6] focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-xs text-faint">Markdown. Use ### or deeper for headings inside a section.</p>
          {conflict && (
            <div role="alert" className="mt-3 flex flex-col gap-3 rounded-[10px] border border-warn-line bg-warn-tint px-4 py-3">
              <p className="font-semibold">The GM changed this section while you were editing. Which version do you want to keep?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold tracking-[0.6px] text-muted uppercase">The GM&apos;s version now</div>
                  <p className="mt-1 font-serif whitespace-pre-wrap">{body === base ? "Loading…" : body || "(empty)"}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-[0.6px] text-muted uppercase">Yours</div>
                  <p className="mt-1 font-serif whitespace-pre-wrap">{draft || "(empty)"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={body === base}
                  onClick={() => {
                    setBase(body);
                    setConflict(false);
                    setConfirming(true);
                  }}
                >
                  Keep mine
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    forget();
                    setDraft(body);
                    setBase(body);
                    setConflict(false);
                    setEditing(false);
                  }}
                >
                  Use the GM&apos;s version
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={draft === base || conflict} onClick={save}>Save</button>
            <button type="button" className="btn btn-sm" onClick={() => { forget(); setEditing(false); setConflict(false); onCancel?.(); }}>Cancel</button>
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
