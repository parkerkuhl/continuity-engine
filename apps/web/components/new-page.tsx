import Link from "next/link";
import type { Entity, Scope } from "@continuity/core";
import { createPage } from "@/app/actions";
import { basePath } from "@/lib/server";
import { ActionForm } from "./action-form";
import { TYPE_LABEL } from "./wiki-browser";

/** The New page form (UX review #5). After saving, the page opens with its outline slots ready to write. */
export function NewPage({ scope, type }: { scope: Scope; type?: string }) {
  const base = basePath(scope);
  const wiki = scope.campaign ? `${base}/wiki` : base;
  const preset = (Object.keys(TYPE_LABEL) as Entity["type"][]).find((t) => t === type) ?? "character";
  return (
    <>
      <div className="text-[13px] text-faint">
        <Link href={wiki} className="link">
          Wiki
        </Link>{" "}
        / New page
      </div>
      <div>
        <h1 className="page-title">New page</h1>
        <p className="mt-1.5 text-muted">
          {scope.campaign
            ? `In ${scope.campaign.name} only. The GM sees it at the start of the next session.`
            : `In ${scope.world.name}, for every campaign. The GM sees it at the start of the next session.`}
        </p>
      </div>
      <ActionForm action={createPage} keepInput className="card grid max-w-2xl gap-4">
        <input type="hidden" name="worldId" value={scope.world.id} />
        <input type="hidden" name="campaignId" value={scope.campaign?.id ?? ""} />
        <input type="hidden" name="base" value={base} />
        <div className="flex flex-wrap gap-4">
          <label className="grid flex-[1_1_180px] gap-1.5 text-[13px] font-semibold">
            Kind of page
            <select name="type" defaultValue={preset} className="input font-normal">
              {(Object.keys(TYPE_LABEL) as Entity["type"][]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid flex-[1_1_180px] gap-1.5 text-[13px] font-semibold">
            Source
            <select name="source" defaultValue="canon" className="input font-normal">
              <option value="canon">Canon</option>
              <option value="invention">Invention</option>
              <option value="unverified">Unverified (check later)</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1.5 text-[13px] font-semibold">
          Name
          <input name="name" required autoFocus className="input font-normal" placeholder="Wren Tallow" />
        </label>
        <div className="grid gap-1.5 text-[13px]">
          <label htmlFor="np-aliases" className="font-semibold">
            Also called
          </label>
          <input id="np-aliases" name="aliases" aria-describedby="np-aliases-hint" className="input" placeholder="the Heron, Tallow" />
          <span id="np-aliases-hint" className="text-faint">
            Nicknames and titles, separated by commas. Search finds the page by any of them.
          </span>
        </div>
        <div className="grid gap-1.5 text-[13px]">
          <label htmlFor="np-summary" className="font-semibold">
            Current state
          </label>
          <textarea id="np-summary" name="summary" rows={3} aria-describedby="np-summary-hint" className="input font-serif text-base" placeholder="Who or what this is right now, in a sentence or two." />
          <span id="np-summary-hint" className="text-faint">
            What the GM reads first. You can add sections on the next screen.
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">Create page</button>
          <Link href={wiki} className="btn">
            Cancel
          </Link>
        </div>
      </ActionForm>
    </>
  );
}
