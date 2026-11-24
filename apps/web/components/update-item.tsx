"use client";
import { useState, type ReactNode } from "react";
import { ActionForm, type ActionState } from "./action-form";

type Action = (prev: ActionState, f: FormData) => Promise<ActionState>;

/**
 * A proposed update with its Approve / Edit / Reject buttons. Edit swaps the text for a form in
 * place. `layout` "row" puts the buttons on the right (review queue), "stack" under the text.
 */
export function UpdateItem({
  head,
  body,
  foot,
  approve,
  reject,
  edit,
  layout = "row",
  editLabel = "Edit",
  hideBody,
}: {
  head: ReactNode;
  body: string;
  foot?: ReactNode;
  approve?: ReactNode;
  reject?: ReactNode;
  edit?: { action: Action; hidden: Record<string, string>; seq: number; severity: string; label?: string };
  layout?: "row" | "stack";
  editLabel?: string;
  /** The body is shown elsewhere (a conflict's side-by-side panes); only the edit form uses it. */
  hideBody?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const buttons = (approve || reject || edit) && (
    <div className="flex flex-wrap items-start gap-1.5">
      {approve}
      {edit && (
        <button type="button" className="btn btn-sm" aria-expanded={editing} onClick={() => setEditing((x) => !x)}>
          {editLabel}
        </button>
      )}
      {reject}
    </div>
  );
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {head}
      {editing && edit ? (
        <ActionForm
          className="grid gap-2"
          action={async (prev, f) => {
            const r = await edit.action(prev, f);
            if (r.ok) setEditing(false);
            return r;
          }}
        >
          {Object.entries(edit.hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <textarea name="body" defaultValue={body} rows={3} className="input font-serif text-base" aria-label={`Edit update #${edit.seq}`} />
          <div className="flex flex-wrap gap-2">
            <select name="severity" defaultValue={edit.severity} className="input w-auto" aria-label="Severity">
              <option value="minor">Minor</option>
              <option value="major">Major</option>
            </select>
            <button className="btn-primary btn-sm">Save edit</button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </ActionForm>
      ) : hideBody ? null : (
        <p className="m-0">{body}</p>
      )}
      {foot}
    </div>
  );
  if (layout === "stack") {
    return (
      <>
        {content}
        {buttons && <div className="mt-2.5">{buttons}</div>}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-3.5">
      {content}
      {buttons}
    </div>
  );
}
