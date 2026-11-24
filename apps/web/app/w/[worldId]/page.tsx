import { WikiBrowser, WikiHeader } from "@/components/wiki-browser";
import { worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function WorldWiki({ params, searchParams }: { params: Promise<{ worldId: string }>; searchParams: Promise<{ q?: string; source?: string; type?: string }> }) {
  const scope = await worldScope((await params).worldId);
  const { q, source, type } = await searchParams;
  return (
    <>
      <WikiHeader scope={scope} title={scope.world.name} />
      <WikiBrowser scope={scope} {...(q && { query: q })} {...(source && { source })} {...(type && { type })} />
    </>
  );
}
