import { Markdown } from "@/components/markdown";
import { app, campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { design: "Story design", clock: "Clocks", twist: "Twists", ending: "Endings", setup: "Setups", motif: "Motifs" };

export default async function GmNotes({ params }: { params: Promise<{ campaignId: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const notes = await (await app()).views.gmNotes(scope);
  if (!notes) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-secret-line bg-secret-tint px-8 py-12 text-center">
        <h1 className="font-serif text-2xl font-semibold">GM notes are hidden</h1>
        <p className="mt-2 text-muted">Switch to GM view in the bar above to see the story design, clocks, twists and endings.</p>
      </div>
    );
  }
  const kinds = ["design", "clock", "twist", "ending", "setup", "motif"].filter((k) => notes.some((n) => n.kind === k));
  return (
    <>
      <div>
        <h1 className="page-title">GM notes</h1>
        <p className="mt-1.5 text-muted">The GM&apos;s hidden story design, written with gm_write. The player never sees these in play.</p>
      </div>
      {notes.length === 0 && <p className="text-muted">No GM notes yet. The GM writes them during intake.</p>}
      {kinds.map((k) => (
        <section key={k}>
          <h2 className="label mb-3">{KIND_LABEL[k]}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5">
            {notes
              .filter((n) => n.kind === k)
              .map((n) => {
                const clock = n.kind === "clock" && n.data ? (n.data as { step: number; steps: number; advances_on: string }) : null;
                return (
                  <div key={n.id} className="rounded-xl border border-dashed border-secret-line bg-secret-tint px-6 py-5">
                    <p className="font-mono text-xs text-secret">{n.key}</p>
                    {clock && (
                      <div className="my-2">
                        <div className="flex gap-1" aria-label={`Step ${clock.step} of ${clock.steps}`}>
                          {Array.from({ length: clock.steps }, (_, i) => (
                            <span key={i} className={`h-2 flex-1 rounded-sm ${i < clock.step ? "bg-danger-line" : "bg-line"}`} />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          Step {clock.step} of {clock.steps}. Advances on: {clock.advances_on}
                        </p>
                      </div>
                    )}
                    <Markdown>{n.bodyMd}</Markdown>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}
