import { PageQueue } from "@/components/page-queue";
import { app, worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

const MODE: Record<string, string> = {
  review: "Review everything: drafted pages wait here before they count as canon.",
  batch: "Batch review: the GM already uses drafted pages as soft canon until you decide.",
  autopilot: "Autopilot: drafted pages went straight to canon.",
  mixed: "Mixed: in a world, every drafted page waits for review.",
};

export default async function WorldReview({ params }: { params: Promise<{ worldId: string }> }) {
  const scope = await worldScope((await params).worldId);
  const n = (await (await app()).views.pageQueue(scope)).length;
  return (
    <>
      <div>
        <h1 className="page-title">Review queue</h1>
        <p className="mt-1.5 text-muted">
          {n === 0 ? "Nothing waiting." : `${n} page${n === 1 ? "" : "s"} the GM drafted.`} {MODE[scope.world.defaultApprovalMode]}
        </p>
      </div>
      <PageQueue scope={scope} path={`/w/${scope.world.id}/review`} />
      {n === 0 && <p className="text-muted">Nothing to review.</p>}
    </>
  );
}
