"use client";
import { useEffect, useRef } from "react";

/**
 * SPEC "Edit confirm": saving a change to what the wiki says asks whether it is a retcon (it was
 * always this way) or a change from now on. The answer is the edit's edit_kind, which the GM
 * sees in the next session's change feed. It renders inside the caller's form, so "Save" submits it.
 */
export function EditConfirm({
  onCancel,
  context,
  before,
  after,
  submit = "Save edit",
  note = "Either way, this section is locked against GM edits and the GM sees the change at the start of the next session.",
}: {
  onCancel: () => void;
  context?: string;
  before?: string;
  after?: string;
  submit?: string;
  note?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,24,27,0.55)] p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="edit-confirm-title" className="flex max-h-full w-[600px] max-w-full flex-col gap-4 overflow-y-auto rounded-[14px] bg-surface p-6 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div>
          <h2 id="edit-confirm-title" className="font-serif text-2xl font-semibold">
            How should the GM treat this change?
          </h2>
          {context && <p className="mt-1.5 text-muted">{context}</p>}
        </div>
        {(before !== undefined || after !== undefined) && (
          <div className="max-h-56 overflow-y-auto rounded-[10px] bg-canvas px-3.5 py-3 font-serif text-base whitespace-pre-wrap">
            {before && <span className="block text-faint line-through">{before}</span>}
            {after && <span className="block">{after}</span>}
          </div>
        )}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">Edit kind</legend>
          <Choice value="retcon" title="Retcon: it was always this way" checked>
            The GM uses the new version from now on and never explains the difference in the story.
          </Choice>
          <Choice value="forward" title="Change from now on">
            Something happened in the story. The GM may account for it in the fiction if it matters.
          </Choice>
        </fieldset>
        {note && <p className="text-[13px] text-muted">{note}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {submit}
          </button>
        </div>
      </div>
    </div>
  );
}

function Choice({ value, title, checked, children }: { value: string; title: string; checked?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-[10px] border border-line-strong px-4 py-3.5 has-[input:checked]:border-accent has-[input:checked]:bg-accent-tint has-[input:checked]:ring-1 has-[input:checked]:ring-accent">
      <input type="radio" name="editKind" value={value} defaultChecked={checked} className="mt-[3px] accent-accent" aria-label={title} />
      <span>
        <b>{title}</b>
        <br />
        <span className="text-muted">{children}</span>
      </span>
    </label>
  );
}
