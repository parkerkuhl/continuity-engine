import { AppShell } from "@/components/app-shell";
import { worldScope } from "@/lib/server";

export default async function WorldLayout({ children, params }: { children: React.ReactNode; params: Promise<{ worldId: string }> }) {
  return <AppShell scope={await worldScope((await params).worldId)}>{children}</AppShell>;
}
