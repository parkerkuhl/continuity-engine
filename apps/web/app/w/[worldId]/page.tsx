import { WikiBrowser } from "@/components/wiki-browser";
import { worldScope } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function WorldWiki({ params, searchParams }: { params: Promise<{ worldId: string }>; searchParams: Promise<{ q?: string; source?: string }> }) {
  const scope = await worldScope((await params).worldId);
  const { q, source } = await searchParams;
  return (
    <>
      <h1 className="mb-4 font-serif text-2xl font-semibold">{scope.world.name}</h1>
      {scope.world.pitch && <p className="-mt-3 mb-5 font-serif text-stone-600 dark:text-stone-400">{scope.world.pitch}</p>}
      <WikiBrowser scope={scope} {...(q && { query: q })} {...(source && { source })} />
    </>
  );
}
