import { EntityView } from "@/components/entity-view";
import { entityName, scopeTitle, worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ worldId: string; slug: string }> }) {
  const { worldId, slug } = await params;
  const scope = await worldScope(worldId);
  return scopeTitle(scope, await entityName(scope, slug));
}

export default async function WorldEntity({ params, searchParams }: { params: Promise<{ worldId: string; slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { worldId, slug } = await params;
  return <EntityView scope={await worldScope(worldId)} slug={slug} {...((await searchParams).tab && { tab: (await searchParams).tab })} />;
}
