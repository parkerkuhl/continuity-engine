"use client";
import { useState } from "react";
import type { ActionState } from "./action-form";
import { InlineEditor } from "./section-editor";

type Action = (prev: ActionState, f: FormData) => Promise<ActionState>;

export interface Slot {
  key: string;
  heading: string;
  hidden: Record<string, string>;
  context: string;
}

/**
 * The outline sections nobody has written yet, as one line of Write buttons instead of a card each.
 * Choosing one opens its editor under the line; nothing is stored until the user saves.
 */
export function EmptySlots({ slots, action }: { slots: Slot[]; action: Action }) {
  const [open, setOpen] = useState<string | null>(null);
  const slot = slots.find((s) => s.key === open);
  return (
    <section aria-labelledby="empty-slots-h" className="rounded-xl border border-dashed border-line-strong px-6 py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h2 id="empty-slots-h" className="mr-1 text-[13px] text-faint">
          Not written yet
        </h2>
        {slots.map((s) => (
          <button
            key={s.key}
            id={`slot-${s.key}`}
            type="button"
            aria-pressed={open === s.key}
            aria-label={`Write ${s.heading}`}
            onClick={() => setOpen(open === s.key ? null : s.key)}
            className={`rounded-md px-2 py-1 text-[13px] font-medium ${open === s.key ? "bg-accent-soft text-accent-ink" : "text-accent hover:bg-accent-tint hover:text-accent-hover"}`}
          >
            + {s.heading}
          </button>
        ))}
      </div>
      {slot && (
        <InlineEditor
          key={slot.key}
          action={action}
          body=""
          hidden={slot.hidden}
          label={`section ${slot.heading}`}
          editText="Write"
          context={slot.context}
          className="mt-3"
          startEditing
          onCancel={() => setOpen(null)}
          title={<h3 className="section-title">{slot.heading}</h3>}
        >
          <p className="text-faint">Nothing here yet.</p>
        </InlineEditor>
      )}
    </section>
  );
}
