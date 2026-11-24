// Milestone 8, end to end against `next start` in remote mode on a real Postgres:
//  - discovery: the /mcp endpoint answers 401 with resource metadata; both metadata documents resolve
//  - a client registers itself (RFC 7591) and swaps a PKCE code for tokens at /oauth/token
//  - Claude's side over streamable HTTP: create a world, open a campaign, get context, log a scene
//  - a second account's token sees none of it
//  - the web app sends signed-out visitors to /login
//
//   CONTINUITY_TEST_PG_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm --filter @continuity/web e2e:remote
//
// The sign-in step itself (Supabase) is stood in for by creating the authorization code directly in the
// database, as /oauth/authorize does after the consent screen. Build the web app first.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { openRemote } from "@continuity/core";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.CONTINUITY_TEST_PG_URL;
if (!base) throw new Error("Set CONTINUITY_TEST_PG_URL to a Postgres server.");
const dbName = `ce_e2e_${randomUUID().replace(/-/g, "")}`;
const admin = postgres(base, { onnotice: () => {} });
await admin.unsafe(`CREATE DATABASE "${dbName}"`);
const url = new URL(base);
url.pathname = `/${dbName}`;
const DB = url.toString();

const PORT = Number(process.env.PORT || 3124);
const BASE = `http://localhost:${PORT}`;
const results: { check: string; pass: boolean; detail?: string }[] = [];
const check = (name: string, pass: boolean, detail?: string) => {
  results.push({ check: name, pass, ...(detail && { detail }) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail && !pass ? ` (${detail})` : ""}`);
};

const web = spawn(process.execPath, [join(here, "../node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
  cwd: join(here, ".."),
  env: {
    ...process.env,
    CONTINUITY_DATABASE_URL: DB,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
    CONTINUITY_PUBLIC_URL: BASE,
  },
  stdio: ["ignore", "inherit", "inherit"],
});
const stop = async () => {
  web.kill();
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.end();
};

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${BASE}/.well-known/oauth-authorization-server`)).ok) break;
    } catch {}
    if (i > 120) throw new Error("next start did not come up");
    await new Promise((r) => setTimeout(r, 500));
  }

  // ---- discovery ----
  const anon = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" });
  const challenge = anon.headers.get("www-authenticate") ?? "";
  check("/mcp without a token is 401 with resource metadata", anon.status === 401 && challenge.includes(`resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp"`), `${anon.status} ${challenge}`);
  const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json();
  check("protected resource metadata names the resource and this server", prm.resource === `${BASE}/mcp` && prm.authorization_servers?.[0] === BASE);
  const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
  check("authorization server metadata offers PKCE S256 and registration", asm.code_challenge_methods_supported?.includes("S256") && asm.registration_endpoint === `${BASE}/oauth/register`);

  // ---- registration and token exchange ----
  const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
  const reg = await fetch(asm.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" }) });
  const client = await reg.json();
  check("dynamic client registration returns a client_id", reg.status === 201 && typeof client.client_id === "string");
  const badReg = await fetch(asm.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["http://evil.example/cb"] }) });
  check("registration refuses a plain-http redirect", badReg.status === 400);

  const { storage, remote } = await openRemote(DB);
  const tokenFor = async (userId: string, name: string) => {
    if (!(await storage.getUser(userId))) await storage.createUser({ id: userId, name }, { author: "user", reason: "first sign-in" });
    const verifier = randomBytes(32).toString("base64url");
    const code = await remote.createCode({ clientId: client.client_id, userId, redirectUri: REDIRECT, codeChallenge: createHash("sha256").update(verifier).digest("base64url") });
    const res = await fetch(asm.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier, client_id: client.client_id }),
    });
    return { status: res.status, body: await res.json() };
  };
  const parker = await tokenFor(randomUUID(), "Parker");
  check("the token endpoint swaps a PKCE code for tokens", parker.status === 200 && parker.body.token_type === "Bearer" && !!parker.body.refresh_token);
  const refreshed = await fetch(asm.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: parker.body.refresh_token, client_id: client.client_id }),
  });
  const fresh = await refreshed.json();
  check("a refresh token gets a new access token", refreshed.status === 200 && !!fresh.access_token);

  // ---- Claude's side ----
  const connect = async (token: string) => {
    const c = new Client({ name: "e2e-claude", version: "0" });
    await c.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await c.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { text: r.content[0]!.text, status: r.content[1] ? JSON.parse(r.content[1].text) : {}, isError: !!r.isError };
    };
    return { call, close: () => c.close() };
  };
  const a = await connect(fresh.access_token);
  const w = await a.call("create_world", { name: "The Free Cities", depth: "compact", approval_mode: "autopilot" });
  const worldId = w.status.world_id as string;
  await a.call("create_entity", { world_id: worldId, type: "character", name: "Rickard Snow", source: "invention", summary: "Sellsword captain." });
  await a.call("create_entity", { world_id: worldId, type: "character", name: "Marro", source: "invention", summary: "Rickard's squire." });
  const camp = await a.call("create_campaign", { world_id: worldId, name: "Run 1" });
  const campaignId = camp.status.campaign_id as string;
  const opened = await a.call("open_campaign", { campaign_id: campaignId });
  check("over HTTP: open_campaign", !opened.isError, opened.text.slice(0, 200));
  // Each call is a new HTTP request and a new server; the session comes from the database.
  const ctx = await a.call("get_context", { campaign_id: campaignId, present: ["Rickard Snow", "Marro"] });
  check("over HTTP: get_context finds the open session from storage", !ctx.isError && ctx.text.includes("Rickard Snow"), ctx.text.slice(0, 200));
  const logged = await a.call("log_scene", {
    campaign_id: campaignId,
    summary: "Marro bandaged Rickard's shoulder.",
    present: ["Rickard Snow", "Marro"],
    updates: [{ entities: ["Rickard Snow"], type: "status-change", severity: "minor", body: "Rickard's left shoulder is wounded.", tags: ["ch-01"], knows: ["Rickard Snow", "Marro"] }],
  });
  check("over HTTP: log_scene stores the update", !logged.isError && /confirmed/.test(logged.text), logged.text.slice(0, 300));
  const imp = await a.call("import_document", { world_id: worldId, title: "places.md", entities: [{ type: "place", name: "Volantis", summary: "The oldest Free City." }] });
  const conf = await a.call("confirm_import", { import_id: imp.status.import_id, accepted: [0] });
  check("over HTTP: import_document then confirm_import on separate requests", !conf.isError && conf.text.includes("Volantis"), conf.text.slice(0, 200));
  await a.close();

  // ---- a second account ----
  const other = await tokenFor(randomUUID(), "Other");
  const b = await connect(other.body.access_token);
  const list = await b.call("list_worlds");
  check("second account: list_worlds shows none of the first account's worlds", !list.text.includes("The Free Cities"), list.text.slice(0, 200));
  const steal = await b.call("open_campaign", { campaign_id: campaignId });
  check("second account: can't open the first account's campaign", steal.isError);
  const peek = await b.call("get_context", { campaign_id: campaignId, present: ["Rickard Snow"] });
  check("second account: can't read through the first account's session", peek.isError);
  const write = await b.call("create_entity", { world_id: worldId, type: "place", name: "Lys", source: "canon" });
  check("second account: can't write to the first account's world", write.isError && !(await storage.getEntityBySlug(worldId, "lys")));
  await b.close();
  storage.close();

  // ---- web sign-in gate ----
  const home = await fetch(`${BASE}/`, { redirect: "manual" });
  check("web: a signed-out visitor is sent to /login", home.status === 307 && (home.headers.get("location") ?? "").includes("/login"), `${home.status} ${home.headers.get("location")}`);
  const consent = await fetch(`${BASE}/oauth/authorize?client_id=${client.client_id}`, { redirect: "manual" });
  check("web: the consent screen needs sign-in too", consent.status === 307 && (consent.headers.get("location") ?? "").includes("/login?next=%2Foauth%2Fauthorize"));
} catch (e) {
  check("e2e run", false, (e as Error).stack);
} finally {
  await stop();
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
