import { AppShell } from "@/components/app-shell";
import { campaignScope } from "@/lib/server";

export default async function CampaignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ campaignId: string }> }) {
  return <AppShell scope={await campaignScope((await params).campaignId)}>{children}</AppShell>;
}
