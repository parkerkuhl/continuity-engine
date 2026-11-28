"use client";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

export interface JumpEntry {
  slug: string;
  name: string;
  aliases: string[];
  type: string;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pages whose name or alias has a word starting with every typed word: names first, then aliases. Up to 8. */
function matches(q: string, index: JumpEntry[]): { e: JumpEntry; alias: string | null }[] {
  const terms = norm(q).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) return [];
  const hit = (text: string) => {
    const words = norm(text).match(/[\p{L}\p{N}]+/gu) ?? [];
    return terms.every((t) => words.some((w) => w.startsWith(t)));
  };
  const out: { e: JumpEntry; alias: string | null; rank: number }[] = [];
  for (const e of index) {
    if (hit(e.name)) out.push({ e, alias: null, rank: norm(e.name).startsWith(terms[0]!) ? 0 : 1 });
    else {
      const a = e.aliases.find(hit);
      if (a) out.push({ e, alias: a, rank: 2 });
    }
  }
  return out.sort((a, b) => a.rank - b.rank || a.e.name.localeCompare(b.e.name)).slice(0, 8);
}

/**
 * A search box with a quick-jump list as you type (UX review #11): arrow keys and Enter open a page directly,
 * with "matched alias" when an alias matched. Enter with nothing highlighted submits the form (the full results).
 */
export function QuickJumpInput({ index, base, defaultValue, className }: { index: JumpEntry[]; base: string; defaultValue?: string; className?: string }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useMemo(() => matches(q, index), [q, index]);
  const show = open && q.trim().length > 0 && list.length > 0;
  const go = (slug: string) => {
    setOpen(false);
    router.push(`${base}/e/${slug}`);
  };
  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % list.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? list.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            go(list[active]!.e.slug);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search names, aliases, places…"
        aria-label="Search the wiki"
        role="combobox"
        aria-expanded={show}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        {...(show && active >= 0 && { "aria-activedescendant": `${id}-${active}` })}
        className={className ?? "w-full min-w-0 bg-transparent outline-none placeholder:text-faint"}
      />
      {show && (
        <ul id={`${id}-list`} role="listbox" aria-label="Jump to a page" className="absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
          {list.map(({ e, alias }, i) => (
            <li
              key={e.slug}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => {
                ev.preventDefault();
                go(e.slug);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 ${i === active ? "bg-accent-tint" : ""}`}
            >
              <span className="min-w-0 truncate">
                <b className="font-semibold text-ink">{e.name}</b>
                {alias && <span className="ml-2 text-xs text-faint">matched alias: {alias}</span>}
              </span>
              <span className="shrink-0 text-xs text-faint capitalize">{e.type === "concept" ? "setting" : e.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
