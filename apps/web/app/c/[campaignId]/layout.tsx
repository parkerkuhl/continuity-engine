import { ScopeBar } from "@/components/scope-bar";
import { app, campaignScope } from "@/lib/server";

export default async function CampaignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ campaignId: string }> }) {
  const scope = await campaignScope((await params).campaignId);
  const { items } = await app().views.reviewQueue(scope);
  return (
    <>
      <ScopeBar scope={scope} reviewCount={items.length} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
