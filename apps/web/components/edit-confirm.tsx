"use client";
/**
 * SPEC "Edit confirm": saving a fact change asks whether it is a retcon (always true) or a change
 * from now on. The answer is the edit's edit_kind, which Claude sees in the next change feed.
 */
export function EditConfirm({ onCancel, verb = "Save" }: { onCancel: () => void; verb?: string }) {
  return (
    <div role="dialog" aria-label="How should Claude treat this edit?" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
      <p className="mb-2 font-medium">How should Claude treat this edit?</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="editKind" value="retcon" className="btn-primary">
          {verb} as retcon (always true)
        </button>
        <button type="submit" name="editKind" value="forward" className="btn-primary">
          {verb} as change from now on
        </button>
        <button type="button" onClick={onCancel} className="btn">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
        A retcon was always so, and Claude won&apos;t explain it. A change from now on happened in the story, and Claude accounts for it in the fiction.
      </p>
    </div>
  );
}
