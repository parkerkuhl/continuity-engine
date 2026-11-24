import { EntityView } from "@/components/entity-view";
import { worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function WorldEntity({ params }: { params: Promise<{ worldId: string; slug: string }> }) {
  const { worldId, slug } = await params;
  return <EntityView scope={await worldScope(worldId)} slug={slug} />;
}
