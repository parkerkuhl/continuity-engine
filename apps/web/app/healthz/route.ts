// Health check for the hosted app: connects to the database (running migrations on first connect)
// and reports ok, or the error class. Returns no data.
import { isRemote, remoteDb } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isRemote()) return Response.json({ mode: "local" });
  try {
    const { storage } = await remoteDb();
    await storage.listPermissions("healthz");
    return Response.json({ mode: "remote", db: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const err = e as { code?: string; name?: string; message?: string };
    console.error("healthz", err);
    return Response.json({ mode: "remote", db: "error", code: err.code ?? err.name ?? "unknown", message: (err.message ?? "").replace(/postgres(ql)?:\/\/[^\s]+/g, "<url>").slice(0, 200) }, { status: 503 });
  }
}
