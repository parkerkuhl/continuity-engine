import { strToU8, zipSync } from "fflate";
import { app } from "@/lib/server";

export const dynamic = "force-dynamic";

/** The world's Markdown export as a .zip (the layout in SPEC "Page format and export layout"). */
export async function GET(_: Request, { params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const r = await app().engine.exportWorld(worldId);
  if (!r.ok) return new Response(r.refusal.message, { status: 404 });
  const zip = zipSync(Object.fromEntries([...r.value].map(([p, text]) => [p, strToU8(text)])));
  const name = [...r.value.keys()][0]?.split("/")[1] ?? "world";
  return new Response(Buffer.from(zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}.zip"` },
  });
}
