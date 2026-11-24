/** The PC sheet: name, health and stress, bonds, stats, what they carry, trackers and notes. */
export function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("current" in o && "max" in o) return `${text(o.current)}/${text(o.max)}`;
    if ("name" in o)
      return [
        text(o.name),
        ...Object.entries(o)
          .filter(([k]) => k !== "name")
          .map(([, x]) => text(x)),
      ]
        .filter(Boolean)
        .join(": ");
    return Object.entries(o)
      .map(([k, x]) => `${k} ${text(x)}`)
      .join(", ");
  }
  return "";
}
const signed = (v: unknown) => (typeof v === "number" && v > 0 ? `+${v}` : text(v));
/** A bond as [who, what]: an object's name and the rest, or a "Name: relation" string split at the first colon. */
function bond(b: unknown): [string, string] {
  if (b && typeof b === "object" && !Array.isArray(b) && "name" in b) {
    const o = b as Record<string, unknown>;
    return [
      text(o.name),
      Object.entries(o)
        .filter(([k]) => k !== "name")
        .map(([, x]) => text(x))
        .filter(Boolean)
        .join(", "),
    ];
  }
  const t = text(b);
  const i = t.indexOf(":");
  return i > 0 ? [t.slice(0, i).trim(), t.slice(i + 1).trim()] : [t, ""];
}
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
      {(data.health !== undefined || data.stress !== undefined) && (
        <div className="flex flex-wrap gap-1.5">
          {data.health !== undefined && <span className="pill bg-danger-soft text-danger">Health {text(data.health)}</span>}
          {data.stress !== undefined && <span className="pill bg-warn-soft text-warn">Stress {text(data.stress)}</span>}
        </div>
      )}
      {stats.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2 text-center">
          {stats.map(([k, v]) => (
            <div key={k} className="flex flex-col justify-center rounded-lg bg-canvas px-2 py-2">
              <div className="text-xs leading-tight text-balance text-muted">{cap(k)}</div>
              <b className="mt-0.5 text-[15px]">{signed(v)}</b>
            </div>
          ))}
        </div>
      )}
      {bonds.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold tracking-[0.6px] text-muted uppercase">Bonds</h3>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {bonds.map((b, i) => {
              const [who, what] = bond(b);
              return (
                <li key={i} className="border-l-2 border-accent pl-2.5 leading-snug">
                  <b className="font-semibold">{who}</b>
                  {what && <span className="block text-[13px] text-muted">{what}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {showInventory && Array.isArray(data.inventory) && data.inventory.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold tracking-[0.6px] text-muted uppercase">Carrying</h3>
          <ul className="list-disc space-y-0.5 pl-5 marker:text-faint">
            {data.inventory.map((x, i) => (
              <li key={i}>{text(x)}</li>
            ))}
          </ul>
        </div>
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
