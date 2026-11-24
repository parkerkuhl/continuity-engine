import { EntityView } from "@/components/entity-view";
import { worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function WorldEntity({ params, searchParams }: { params: Promise<{ worldId: string; slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { worldId, slug } = await params;
  return <EntityView scope={await worldScope(worldId)} slug={slug} {...((await searchParams).tab && { tab: (await searchParams).tab })} />;
}
