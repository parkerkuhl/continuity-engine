import { WikiBrowser } from "@/components/wiki-browser";
import { campaignScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function CampaignWiki({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<{ q?: string; source?: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const { q, source } = await searchParams;
  return (
    <>
      <h1 className="mb-4 font-serif text-2xl font-semibold">Wiki</h1>
      <WikiBrowser scope={scope} {...(q && { query: q })} {...(source && { source })} />
    </>
  );
}
