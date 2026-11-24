import { NewPage } from "@/components/new-page";
import { scopeTitle, worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ worldId: string }> }) {
  return scopeTitle(await worldScope((await params).worldId), "New page");
}

export default async function WorldNewPage({ params, searchParams }: { params: Promise<{ worldId: string }>; searchParams: Promise<{ type?: string }> }) {
  const scope = await worldScope((await params).worldId);
  const { type } = await searchParams;
  return <NewPage scope={scope} {...(type && { type })} />;
}
