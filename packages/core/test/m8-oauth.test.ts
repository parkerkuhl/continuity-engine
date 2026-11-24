// Milestone 8: the OAuth 2.1 store behind Claude's custom connector (dynamic registration, PKCE codes,
// rotating refresh tokens), and pending imports that survive between stateless requests. PGlite.
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { RulesEngine, openRemote, validRedirectUri, type RemoteStore } from "../src";

const challenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const VERIFIER = "a-long-random-code-verifier-for-the-test-0123456789";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
let close: (() => void) | null = null;
afterEach(() => close?.());

async function store() {
  const o = await openRemote("pglite:");
  close = () => o.storage.close();
  return o;
}

async function authorized(remote: RemoteStore) {
  const reg = await remote.registerClient({ redirectUris: [REDIRECT], name: "Claude" });
  if ("error" in reg) throw new Error(reg.error_description);
  const code = await remote.createCode({ clientId: reg.client.clientId, userId: "user-parker", redirectUri: REDIRECT, codeChallenge: challenge(VERIFIER) });
  return { clientId: reg.client.clientId, code };
}

describe("M8: OAuth for the custom connector", () => {
  it("accepts https and localhost redirect URIs only", () => {
    expect(validRedirectUri(REDIRECT)).toBe(true);
    expect(validRedirectUri("http://localhost:6274/callback")).toBe(true);
    expect(validRedirectUri("http://evil.example/cb")).toBe(false);
    expect(validRedirectUri("javascript:alert(1)")).toBe(false);
  });

  it("exchanges a code once, with the right PKCE verifier, for a token that names the account", async () => {
    const { remote } = await store();
    const { clientId, code } = await authorized(remote);
    expect(await remote.exchangeCode({ code, clientId, redirectUri: REDIRECT, codeVerifier: "wrong" })).toMatchObject({ error: "invalid_grant" });
    expect(await remote.exchangeCode({ code, clientId, redirectUri: "https://other.example/cb", codeVerifier: VERIFIER })).toMatchObject({ error: "invalid_grant" });
    const tokens = await remote.exchangeCode({ code, clientId, redirectUri: REDIRECT, codeVerifier: VERIFIER });
    if ("error" in tokens) throw new Error(tokens.error_description);
    expect(await remote.verifyAccessToken(tokens.access_token)).toMatchObject({ userId: "user-parker", clientId });
    expect(await remote.verifyAccessToken("not-a-token")).toBeNull();
    // A replayed code is refused and revokes what it issued.
    expect(await remote.exchangeCode({ code, clientId, redirectUri: REDIRECT, codeVerifier: VERIFIER })).toMatchObject({ error: "invalid_grant" });
    expect(await remote.verifyAccessToken(tokens.access_token)).toBeNull();
  });

  it("rotates refresh tokens: each works once", async () => {
    const { remote } = await store();
    const { clientId, code } = await authorized(remote);
    const first = await remote.exchangeCode({ code, clientId, redirectUri: REDIRECT, codeVerifier: VERIFIER });
    if ("error" in first) throw new Error();
    const second = await remote.refresh({ refreshToken: first.refresh_token, clientId });
    if ("error" in second) throw new Error(second.error_description);
    expect(await remote.verifyAccessToken(second.access_token)).toMatchObject({ userId: "user-parker" });
    expect(await remote.refresh({ refreshToken: first.refresh_token, clientId })).toMatchObject({ error: "invalid_grant" });
    expect(await remote.refresh({ refreshToken: second.refresh_token, clientId: "someone-else" })).toMatchObject({ error: "invalid_grant" });
  });

  it("confidential clients must send their secret", async () => {
    const { remote } = await store();
    const reg = await remote.registerClient({ redirectUris: [REDIRECT], authMethod: "client_secret_post" });
    if ("error" in reg) throw new Error();
    expect(reg.clientSecret).toBeTruthy();
    expect(await remote.authenticateClient(reg.client.clientId, null)).toBeNull();
    expect(await remote.authenticateClient(reg.client.clientId, "wrong")).toBeNull();
    expect(await remote.authenticateClient(reg.client.clientId, reg.clientSecret)).toMatchObject({ clientId: reg.client.clientId });
  });
});

describe("M8: a pending import survives between requests", () => {
  it("import_document on one engine, confirm_import on a fresh one", async () => {
    const { storage, remote } = await store();
    const user = await storage.createUser({ id: "user-parker", name: "Parker" }, { author: "user" });
    const one = new RulesEngine(storage, { ownerId: user.id, imports: remote.imports() });
    const w = await one.createWorld({ name: "The Free Cities", depth: "compact", approvalMode: "autopilot" });
    if (!w.ok) throw new Error();
    const rep = await one.importDocument({ worldId: w.value.id, title: "people.md", entities: [{ type: "character", name: "Marro" }] });
    if (!rep.ok) throw new Error(rep.refusal.message);
    const two = new RulesEngine(storage, { ownerId: user.id, imports: remote.imports() });
    const done = await two.confirmImport({ importId: rep.value.importId, accept: [0] });
    if (!done.ok) throw new Error(done.refusal.message);
    expect(done.value.created.map((p) => p.name)).toEqual(["Marro"]);
    expect((await two.confirmImport({ importId: rep.value.importId, accept: [0] })).ok).toBe(false);
  });
});
