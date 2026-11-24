import Link from "next/link";
import type { Scope } from "@continuity/core";
import { setCampaignSpoilers, setWorldSpoilers } from "@/app/actions";
import { EyeOffIcon } from "./icons";

/** The bar on every world and campaign screen, with the spoiler toggle (default off). */
export async function ScopeBar({ scope, reviewCount }: { scope: Scope; reviewCount?: number }) {
  const c = scope.campaign;
  const base = c ? `/c/${c.id}` : `/w/${scope.world.id}`;
  const links = c
    ? [
        { href: base, label: "Dashboard" },
        { href: `${base}/wiki`, label: "Wiki" },
        { href: `${base}/review`, label: `Review${reviewCount ? ` (${reviewCount})` : ""}` },
        ...(scope.spoilers ? [{ href: `${base}/gm`, label: "GM notes" }] : []),
      ]
    : [{ href: base, label: "Wiki" }];
  return (
    <div className="border-b border-stone-200 bg-stone-100/70 dark:border-stone-800 dark:bg-stone-900/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 text-sm">
        <div className="min-w-0">
          <span className="text-stone-500">{scope.world.name}</span>
          {c && (
            <>
              <span className="px-1 text-stone-400">/</span>
              <span className="font-semibold">{c.name}</span>
            </>
          )}
        </div>
        <nav className="flex flex-wrap gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-stone-700 hover:underline dark:text-stone-300">
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={c ? setCampaignSpoilers : setWorldSpoilers} className="ml-auto">
          {c && <input type="hidden" name="campaignId" value={c.id} />}
          <input type="hidden" name="on" value={scope.spoilers ? "0" : "1"} />
          <button
            type="submit"
            role="switch"
            aria-checked={scope.spoilers}
            aria-label="GM spoilers"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              scope.spoilers
                ? "border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-900 dark:text-amber-100"
                : "border-stone-300 bg-white text-stone-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {!scope.spoilers && <EyeOffIcon className="h-3.5 w-3.5" />}
            Spoilers {scope.spoilers ? "on (GM view)" : "off"}
          </button>
        </form>
      </div>
    </div>
  );
}
