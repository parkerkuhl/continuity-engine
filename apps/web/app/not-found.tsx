import Link from "next/link";
import { AppShell } from "@/components/app-shell";

/** Any unknown URL: a message inside the app shell with a way back (UX review #26). */
export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <h1 className="page-title">Nothing here</h1>
        <p className="text-muted">That world, campaign or page doesn&apos;t exist, or this account can&apos;t see it.</p>
        <p>
          <Link href="/" className="btn">
            All worlds
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
