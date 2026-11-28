import { EntityView } from "@/components/entity-view";
import { campaignScope, entityName, scopeTitle } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ campaignId: string; slug: string }> }) {
  const { campaignId, slug } = await params;
  const scope = await campaignScope(campaignId);
  return scopeTitle(scope, await entityName(scope, slug));
}

export default async function CampaignEntity({ params, searchParams }: { params: Promise<{ campaignId: string; slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { campaignId, slug } = await params;
  return <EntityView scope={await campaignScope(campaignId)} slug={slug} {...((await searchParams).tab && { tab: (await searchParams).tab })} />;
}
