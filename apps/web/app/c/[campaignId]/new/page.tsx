import { NewPage } from "@/components/new-page";
import { campaignScope, scopeTitle } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ campaignId: string }> }) {
  return scopeTitle(await campaignScope((await params).campaignId), "New page");
}

export default async function CampaignNewPage({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<{ type?: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const { type } = await searchParams;
  return <NewPage scope={scope} {...(type && { type })} />;
}
