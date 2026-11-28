/** Small display helpers shared by the entity page and the review queue. */

export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 14 ? `${d} day${d === 1 ? "" : "s"} ago` : new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
};

/** "ch-02, scene 1" */
export const sceneLabel = (s: { chapter: number; number: number } | null) => (s ? `ch-${String(s.chapter).padStart(2, "0")}, scene ${s.number}` : null);
