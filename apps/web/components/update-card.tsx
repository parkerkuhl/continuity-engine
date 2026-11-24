import Link from "next/link";
import type { UpdateView } from "@continuity/core";

const STATUS: Record<string, string> = {
  proposed: "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "border-stone-300 bg-stone-100 text-stone-500 line-through dark:border-stone-700 dark:bg-stone-800",
  retconned: "border-stone-300 bg-stone-100 text-stone-500 dark:border-stone-700 dark:bg-stone-800",
  superseded: "border-stone-300 bg-stone-100 text-stone-500 dark:border-stone-700 dark:bg-stone-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS[status] ?? ""}`}>{status}</span>;
}

/** One update: what it says, its status and severity, who it touches and who knows it. */
export function UpdateMeta({ v, base }: { v: UpdateView; base: string }) {
  const u = v.update;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
      <span className="font-mono">#{u.seq}</span>
      <StatusBadge status={u.status} />
      <span className={`badge ${u.severity === "major" ? "border-red-300 text-red-800 dark:border-red-800 dark:text-red-300" : "border-stone-300"}`}>{u.severity}</span>
      <span>{u.type}</span>
      {u.chapter !== null && <span>ch-{String(u.chapter).padStart(2, "0")}</span>}
      {v.entities.length > 0 && (
        <span>
          about{" "}
          {v.entities.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ", "}
              <Link href={`${base}/e/${e.slug}`} className="underline">
                {e.name}
              </Link>
            </span>
          ))}
        </span>
      )}
      {v.knows.length > 0 && <span>known by {v.knows.map((e) => e.name).join(", ")}</span>}
    </div>
  );
}
