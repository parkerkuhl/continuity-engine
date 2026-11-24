import { WikiBrowser, WikiHeader } from "@/components/wiki-browser";
import { campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function CampaignWiki({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<{ q?: string; source?: string; type?: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const { q, source, type } = await searchParams;
  return (
    <>
      <WikiHeader scope={scope} title="Wiki" />
      <WikiBrowser scope={scope} {...(q && { query: q })} {...(source && { source })} {...(type && { type })} />
    </>
  );
}
