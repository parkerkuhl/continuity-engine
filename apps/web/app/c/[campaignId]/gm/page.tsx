import { Markdown } from "@/components/markdown";
import { app, campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { design: "Story design", clock: "Clocks", twist: "Twists", ending: "Endings", setup: "Setups", motif: "Motifs" };

export default async function GmNotes({ params }: { params: Promise<{ campaignId: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const notes = await app().views.gmNotes(scope);
  if (!notes) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold">GM notes are hidden</h1>
        <p className="mt-2 text-stone-500">Turn spoilers on in the bar above to see the story design, clocks, twists and endings.</p>
      </div>
    );
  }
  const kinds = ["design", "clock", "twist", "ending", "setup", "motif"].filter((k) => notes.some((n) => n.kind === k));
  return (
    <>
      <h1 className="font-serif text-2xl font-semibold">GM notes</h1>
      <p className="text-sm text-stone-500">Claude&apos;s hidden story design. Claude writes these with gm_write; the player never sees them in play.</p>
      {notes.length === 0 && <p className="mt-8 text-stone-500">No GM notes yet. Claude writes them during intake.</p>}
      {kinds.map((k) => (
        <section key={k} className="mt-6">
          <h2 className="label mb-2">{KIND_LABEL[k]}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {notes
              .filter((n) => n.kind === k)
              .map((n) => {
                const clock = n.kind === "clock" && n.data ? (n.data as { step: number; steps: number; advances_on: string }) : null;
                return (
                  <div key={n.id} className="card">
                    <p className="font-mono text-xs text-stone-500">{n.key}</p>
                    {clock && (
                      <div className="my-2">
                        <div className="flex gap-1" aria-label={`Step ${clock.step} of ${clock.steps}`}>
                          {Array.from({ length: clock.steps }, (_, i) => (
                            <span key={i} className={`h-2 flex-1 rounded-sm ${i < clock.step ? "bg-red-500" : "bg-stone-200 dark:bg-stone-700"}`} />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-stone-500">
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
