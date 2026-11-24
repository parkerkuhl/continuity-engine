import { EntityView } from "@/components/entity-view";
import { campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function CampaignEntity({ params, searchParams }: { params: Promise<{ campaignId: string; slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { campaignId, slug } = await params;
  return <EntityView scope={await campaignScope(campaignId)} slug={slug} {...((await searchParams).tab && { tab: (await searchParams).tab })} />;
}
