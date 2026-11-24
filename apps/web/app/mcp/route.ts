/**
 * The remote MCP endpoint (Milestone 8): streamable HTTP, stateless, for Claude's custom connector.
 * Every request carries an OAuth access token; the server it builds sees only that account's worlds.
 * Open sessions live in the database, so any instance can serve any request.
 */
import { createServer } from "@continuity/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { originOf, preflight, resourceMetadataUrl } from "@/lib/oauth";
import { engineFor, isRemote, remoteDb } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "mcp-session-id, www-authenticate" };

function unauthorized(req: Request, description: string): Response {
  return new Response(JSON.stringify({ error: "invalid_token", error_description: description }), {
    status: 401,
    headers: {
      ...CORS,
      "content-type": "application/json",
      "www-authenticate": `Bearer error="invalid_token", error_description="${description}", resource_metadata="${resourceMetadataUrl(originOf(req))}"`,
    },
  });
}

async function handle(req: Request): Promise<Response> {
  if (!isRemote()) return new Response("The MCP endpoint needs the remote database (CONTINUITY_DATABASE_URL). Locally, use the stdio server.", { status: 404 });
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized(req, "Sign in to use this server.");
  const { remote } = await remoteDb();
  const who = await remote.verifyAccessToken(auth.slice(7));
  if (!who) return unauthorized(req, "The access token is invalid or expired.");

  const server = createServer(await engineFor(who.userId), { stateless: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  } finally {
    // JSON responses are complete once handleRequest returns.
    await server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = preflight;
