// RFC 7591 dynamic client registration. Claude registers itself here when the connector is added.
import type { NextRequest } from "next/server";
import { json, preflight } from "@/lib/oauth";
import { remoteDb } from "@/lib/server";

export async function POST(req: NextRequest) {
  let body: { redirect_uris?: unknown; client_name?: unknown; token_endpoint_auth_method?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_client_metadata", error_description: "Send client metadata as JSON." }, 400);
  }
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  const method = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  const { remote } = await remoteDb();
  const r = await remote.registerClient({ redirectUris: uris, name: typeof body.client_name === "string" ? body.client_name : "", authMethod: method });
  if ("error" in r) return json(r, 400);
  return json(
    {
      client_id: r.client.clientId,
      ...(r.clientSecret && { client_secret: r.clientSecret, client_secret_expires_at: 0 }),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: r.client.name,
      redirect_uris: r.client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: r.clientSecret ? method : "none",
    },
    201,
  );
}

export const OPTIONS = preflight;
