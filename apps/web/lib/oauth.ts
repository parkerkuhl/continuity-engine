/**
 * OAuth 2.1 authorization server for Claude's custom connector (Milestone 8). The MCP endpoint is the
 * protected resource; this app is also its authorization server, and signs people in with Supabase.
 * Discovery follows the MCP authorization spec: RFC 9728 resource metadata, RFC 8414 server metadata,
 * RFC 7591 dynamic client registration, PKCE (S256) only.
 */
import type { NextRequest } from "next/server";

/** The public origin: CONTINUITY_PUBLIC_URL when set (behind a proxy), else the request's own. */
export function originOf(req: NextRequest | Request): string {
  if (process.env.CONTINUITY_PUBLIC_URL) return process.env.CONTINUITY_PUBLIC_URL.replace(/\/$/, "");
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}`;
}

export const resourceUrl = (origin: string) => `${origin}/mcp`;
export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource/mcp`;
export const SCOPE = "continuity";

export function serverMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [SCOPE],
  };
}

export function resourceMetadata(origin: string) {
  return {
    resource: resourceUrl(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [SCOPE],
    resource_name: "Continuity Engine",
  };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*", ...headers } });

export const preflight = () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
      "access-control-expose-headers": "mcp-session-id, www-authenticate",
    },
  });
