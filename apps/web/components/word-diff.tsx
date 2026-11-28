// The diff entry point only, so client components (the edit dialog) can use this without the storage code.
import { wordDiff } from "@continuity/core/diff";

/** A word-level diff (UX review #9): removed words struck through on red, added words underlined on green. */
export function WordDiff({ before, after, className = "" }: { before: string; after: string; className?: string }) {
  const parts = wordDiff(before, after);
  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      {parts.map((p, i) =>
        p.op === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.op === "del" ? (
          <del key={i} className="rounded-sm bg-danger-soft px-0.5 text-danger decoration-danger/70">
            <span className="sr-only">[removed: </span>
            {p.text}
            <span className="sr-only">]</span>
          </del>
        ) : (
          <ins key={i} className="rounded-sm bg-ok-soft px-0.5 text-ok underline decoration-ok/60 underline-offset-2">
            <span className="sr-only">[added: </span>
            {p.text}
            <span className="sr-only">]</span>
          </ins>
        ),
      )}
    </p>
  );
}
