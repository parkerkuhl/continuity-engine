/** The PC sheet: name, health and stress, bonds, stats, what they carry, trackers and notes. */
export function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("current" in o && "max" in o) return `${text(o.current)}/${text(o.max)}`;
    if ("name" in o) return [text(o.name), ...Object.entries(o).filter(([k]) => k !== "name").map(([, x]) => text(x))].filter(Boolean).join(": ");
    return Object.entries(o).map(([k, x]) => `${k} ${text(x)}`).join(", ");
  }
  return "";
}
const signed = (v: unknown) => (typeof v === "number" && v > 0 ? `+${v}` : text(v));
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
const KNOWN = new Set(["name", "stats", "health", "stress", "inventory", "bonds", "trackers", "flaw_notes"]);

export function PcSheetBody({ data, showName = true, showInventory = true }: { data: Record<string, unknown>; showName?: boolean; showInventory?: boolean }) {
  const stats = data.stats && typeof data.stats === "object" ? Object.entries(data.stats as Record<string, unknown>) : [];
  const bonds = Array.isArray(data.bonds) ? data.bonds : [];
  const trackers = data.trackers && typeof data.trackers === "object" ? Object.entries(data.trackers as Record<string, unknown>) : [];
  const extra = Object.entries(data).filter(([k]) => !KNOWN.has(k));
  return (
    <>
      {showName && typeof data.name === "string" && <p className="font-serif text-lg font-semibold">{data.name}</p>}
      {(data.health !== undefined || data.stress !== undefined || bonds.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {data.health !== undefined && <span className="rounded-lg bg-danger-soft px-2.5 py-1 font-semibold text-danger">Health {text(data.health)}</span>}
          {data.stress !== undefined && <span className="rounded-lg bg-warn-soft px-2.5 py-1 font-semibold text-warn">Stress {text(data.stress)}</span>}
          {bonds.map((b, i) => (
            <span key={i} className="rounded-lg bg-accent-soft px-2.5 py-1 font-semibold text-accent-ink">
              Bond, {text(b)}
            </span>
          ))}
        </div>
      )}
      {stats.length > 0 && (
        <div className="grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 5)}, minmax(0, 1fr))` }}>
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-canvas px-1 py-2">
              <div className="text-xs text-muted">{cap(k)}</div>
              <b>{signed(v)}</b>
            </div>
          ))}
        </div>
      )}
      {showInventory && Array.isArray(data.inventory) && data.inventory.length > 0 && (
        <p>
          <b>Carrying:</b> {text(data.inventory)}.
        </p>
      )}
      {(trackers.length > 0 || extra.length > 0) && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
          {[...trackers, ...extra].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{cap(k)}</dt>
              <dd>{text(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {typeof data.flaw_notes === "string" && data.flaw_notes && <p className="text-[13px] text-muted">{data.flaw_notes}</p>}
    </>
  );
}
