import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { CopyButton } from "@/components/copy-button";
import { APPROVAL_MODES } from "@/lib/format";
import { app, isRemote, localDbPath } from "@/lib/server";
import { headers } from "next/headers";
import { createCampaign, createWorld, importWorld } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Worlds · Continuity Engine" };

const PROMPT = "Let's build a world";

export default async function Home() {
  const rows = await (await app()).views.home();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "your-site"}`;
  return (
    <AppShell>
      <div>
        <h1 className="page-title">Worlds</h1>
        <p className="mt-1.5 text-muted">
          {rows.length === 0 ? "Three ways to start. Most people build their world with Claude in the chat." : "Your worlds, the same ones Claude sees as the GM."}
        </p>
      </div>
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
                    <span className="flex items-center gap-3 text-xs text-muted">
                      chapter {c.currentChapter} · {c.approvalMode}
                      <a href={`/c/${c.id}/export`} className="link" aria-label={`Export ${c.name}`}>
                        Export
                      </a>
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

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {rows.length === 0 && (
          <section className="card flex flex-col gap-3 border-accent">
            <h2 className="card-title">Build a world with Claude</h2>
            <p className="text-sm text-muted">
              Claude runs a short interview, then writes the pages here for you to approve.{" "}
              {isRemote() ? (
                <>
                  On claude.ai, add a custom connector with the URL <code className="text-[13px] break-all">{origin}/mcp</code> and sign in.
                </>
              ) : (
                <>Add this server to Claude Desktop (see the MCP server&apos;s README), then start a new chat.</>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-sunken px-2 py-1 text-[13px]">{PROMPT}</code>
              <CopyButton text={PROMPT} label="Copy prompt" />
            </div>
          </section>
        )}
        <section className="card">
          <h2 className="card-title">{rows.length === 0 ? "Start an empty world" : "Create a world"}</h2>
          <ActionForm action={createWorld} className="mt-3 grid gap-3">
            <input name="name" placeholder="Name" className="input" aria-label="World name" required />
            <input name="pitch" placeholder="One-line pitch" className="input" aria-label="Pitch" />
            <fieldset className="grid gap-1.5 text-[13px]">
              <legend className="mb-1 font-semibold">Page depth</legend>
              <label className="flex gap-2">
                <input type="radio" name="depth" value="compact" defaultChecked className="mt-[3px] accent-accent" />
                <span>
                  <b>Compact</b> <span className="text-muted">short pages, the essentials only</span>
                </span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="depth" value="full" className="mt-[3px] accent-accent" />
                <span>
                  <b>Full bible</b> <span className="text-muted">detailed pages with history and texture</span>
                </span>
              </label>
            </fieldset>
            <fieldset className="grid gap-1.5 text-[13px]">
              <legend className="mb-1 font-semibold">When Claude adds or changes things</legend>
              {APPROVAL_MODES.map(([v, label, note]) => (
                <label key={v} className="flex gap-2">
                  <input type="radio" name="approvalMode" value={v} defaultChecked={v === "batch"} className="mt-[3px] accent-accent" />
                  <span>
                    <b>{label}</b> <span className="text-muted">{note}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div>
              <button className="btn-primary">Create world</button>
            </div>
          </ActionForm>
        </section>
        <section className="card">
          <h2 className="card-title">Import an export (.zip)</h2>
          <p className="mt-1 text-sm text-muted">
            A .zip made by Export. A world export becomes a new world; a campaign export brings its world with it, so it becomes a new world with the campaign in it.
          </p>
          <ActionForm action={importWorld} className="mt-3 flex flex-wrap gap-2">
            <input type="file" name="file" accept=".zip" className="text-[13px]" aria-label="World or campaign export .zip" required />
            <button className="btn">Import</button>
          </ActionForm>
        </section>
      </div>
      {!isRemote() && (
        <p className="text-xs text-faint">
          About: this app and the GM share the database at <code>{localDbPath()}</code>.
        </p>
      )}
    </AppShell>
  );
}
