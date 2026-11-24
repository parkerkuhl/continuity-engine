import { ScopeBar } from "@/components/scope-bar";
import { worldScope } from "@/lib/server";

export default async function WorldLayout({ children, params }: { children: React.ReactNode; params: Promise<{ worldId: string }> }) {
  const scope = await worldScope((await params).worldId);
  return (
    <>
      <ScopeBar scope={scope} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
