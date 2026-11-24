import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { app, isRemote, localDbPath } from "@/lib/server";
import { createCampaign, createWorld, importWorld } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Worlds · Continuity Engine" };

export default async function Home() {
  const rows = await (await app()).views.home();
  return (
    <AppShell>
      <div>
        <h1 className="page-title">Worlds</h1>
        <p className="mt-1.5 text-muted">
          {isRemote() ? "Your worlds, the same ones Claude sees through the connector." : <>The same database the GM uses: <code className="text-[13px]">{localDbPath()}</code></>}
        </p>
      </div>

      {rows.length === 0 && <p className="text-muted">No worlds yet. Create one below, import an export, or ask Claude to build one.</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
        {rows.map(({ world, campaigns, entityCount }) => (
          <section key={world.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-[22px] font-semibold">
                  <Link href={`/w/${world.id}`} className="hover:text-accent">
                    {world.name}
                  </Link>
                </h2>
                {world.pitch && <p className="mt-1 font-serif text-[15px] text-muted">{world.pitch}</p>}
                <p className="mt-1 text-xs text-muted">
                  {entityCount} page{entityCount === 1 ? "" : "s"} · {world.depth} · default approval: {world.defaultApprovalMode}
                </p>
              </div>
              <a href={`/w/${world.id}/export`} className="btn btn-sm shrink-0">
                Export
              </a>
            </div>
            <h3 className="label mt-4 mb-1">Campaigns</h3>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="space-y-1">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <Link href={`/c/${c.id}`} className="link font-medium">
                      {c.name}
                    </Link>
                    <span className="text-xs text-muted">
                      chapter {c.currentChapter} · {c.approvalMode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={createCampaign} className="mt-3 flex gap-2">
              <input type="hidden" name="worldId" value={world.id} />
              <input name="name" placeholder="New campaign name" className="input" aria-label={`New campaign in ${world.name}`} required />
              <button className="btn shrink-0">Create campaign</button>
            </ActionForm>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
        <section className="card">
          <h2 className="card-title">Create a world</h2>
          <ActionForm action={createWorld} className="mt-3 grid gap-2">
            <input name="name" placeholder="Name" className="input" aria-label="World name" required />
            <input name="pitch" placeholder="One-line pitch" className="input" aria-label="Pitch" />
            <div className="flex flex-wrap gap-2">
              <select name="depth" className="input w-auto" aria-label="Depth" defaultValue="compact">
                <option value="compact">Compact</option>
                <option value="full">Full bible</option>
              </select>
              <select name="approvalMode" className="input w-auto" aria-label="Approval mode" defaultValue="batch">
                <option value="review">Review everything</option>
                <option value="batch">Batch review</option>
                <option value="autopilot">Autopilot</option>
                <option value="mixed">Mixed (by severity)</option>
              </select>
              <button className="btn-primary">Create world</button>
            </div>
          </ActionForm>
        </section>
        <section className="card">
          <h2 className="card-title">Import a world</h2>
          <p className="mt-1 text-sm text-muted">A .zip made by Export: the world folder with its 00-load-guide.md and pages.</p>
          <ActionForm action={importWorld} className="mt-3 flex flex-wrap gap-2">
            <input type="file" name="file" accept=".zip" className="text-[13px]" aria-label="World export .zip" required />
            <button className="btn">Import</button>
          </ActionForm>
        </section>
      </div>
    </AppShell>
  );
}
