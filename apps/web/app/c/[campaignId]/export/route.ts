import { strToU8, zipSync } from "fflate";
import { app } from "@/lib/server";

export const dynamic = "force-dynamic";

/** The campaign's Markdown export, with its world, as a .zip (SPEC "Page format and export layout"). */
export async function GET(_: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const r = await (await app()).engine.exportCampaign(campaignId);
  if (!r.ok) return new Response(r.refusal.message, { status: 404 });
  const zip = zipSync(Object.fromEntries([...r.value].map(([p, text]) => [p, strToU8(text)])));
  const name = [...r.value.keys()].find((p) => p.startsWith("campaigns/"))?.split("/")[1] ?? "campaign";
  return new Response(Buffer.from(zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}.zip"` },
  });
}
