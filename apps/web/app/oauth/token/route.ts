// Token endpoint: authorization_code (with PKCE) and refresh_token grants.
import type { NextRequest } from "next/server";
import { json, preflight } from "@/lib/oauth";
import { remoteDb } from "@/lib/server";

export async function POST(req: NextRequest) {
  const form = new URLSearchParams(await req.text());
  let clientId = form.get("client_id") ?? "";
  let clientSecret = form.get("client_secret");
  const basic = req.headers.get("authorization");
  if (basic?.startsWith("Basic ")) {
    const [id, secret] = Buffer.from(basic.slice(6), "base64").toString().split(":");
    clientId = decodeURIComponent(id ?? "");
    clientSecret = decodeURIComponent(secret ?? "");
  }
  const { remote } = await remoteDb();
  const client = await remote.authenticateClient(clientId, clientSecret);
  if (!client) return json({ error: "invalid_client", error_description: "Unknown client or wrong client secret." }, 401);

  const grant = form.get("grant_type");
  const r =
    grant === "authorization_code"
      ? await remote.exchangeCode({ code: form.get("code") ?? "", clientId, redirectUri: form.get("redirect_uri") ?? "", codeVerifier: form.get("code_verifier") ?? "" })
      : grant === "refresh_token"
        ? await remote.refresh({ refreshToken: form.get("refresh_token") ?? "", clientId })
        : { error: "unsupported_grant_type" as const, error_description: "Use authorization_code or refresh_token." };
  return "error" in r ? json(r, 400) : json(r);
}

export const OPTIONS = preflight;
