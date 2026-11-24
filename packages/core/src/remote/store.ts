/**
 * The remote server's own state (Milestone 8): OAuth 2.1 clients, codes and tokens for Claude's custom
 * connector, and pending imports. Postgres only. The web app's OAuth routes and the /mcp endpoint call
 * this; nothing outside packages/core touches these tables.
 */
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { openPgDb, type PgDb } from "../db-pg";
import type { ImportStore, PendingImport } from "../rules/engine";
import { PgStorage } from "../storage/pg";
import * as r from "../schema-remote";

export const ACCESS_TOKEN_SECONDS = 60 * 60;
export const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const CODE_SECONDS = 10 * 60;

const sha256 = (s: string) => createHash("sha256").update(s).digest("base64url");
const secret = () => randomBytes(32).toString("base64url");
const at = (secondsFromNow = 0) => new Date(Date.now() + secondsFromNow * 1000).toISOString();
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type OAuthError = { error: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type" | "invalid_redirect_uri"; error_description: string };
export interface TokenSet {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}
export interface OAuthClient {
  clientId: string;
  name: string;
  redirectUris: string[];
  confidential: boolean;
}

/** Redirect URIs must be https, or http on localhost (for local MCP clients). */
export function validRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
  } catch {
    return false;
  }
}

export class RemoteStore {
  constructor(private readonly db: PgDb) {}

  // ---- clients (RFC 7591 dynamic registration) ----

  async registerClient(input: { redirectUris: string[]; name?: string; authMethod?: string }): Promise<{ client: OAuthClient; clientSecret: string | null } | OAuthError> {
    if (!input.redirectUris.length || !input.redirectUris.every(validRedirectUri)) {
      return { error: "invalid_redirect_uri", error_description: "redirect_uris must be https URLs (or http on localhost)." };
    }
    const confidential = input.authMethod === "client_secret_post" || input.authMethod === "client_secret_basic";
    const clientSecret = confidential ? secret() : null;
    const client = { clientId: randomUUID(), name: (input.name ?? "").slice(0, 200), redirectUris: input.redirectUris, confidential };
    await this.db.insert(r.oauthClients).values({
      clientId: client.clientId,
      secretHash: clientSecret ? sha256(clientSecret) : null,
      name: client.name,
      redirectUris: client.redirectUris,
      createdAt: at(),
    });
    return { client, clientSecret };
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const [row] = await this.db.select().from(r.oauthClients).where(eq(r.oauthClients.clientId, clientId)).limit(1);
    return row ? { clientId: row.clientId, name: row.name, redirectUris: row.redirectUris, confidential: !!row.secretHash } : null;
  }

  /** Public clients (PKCE only) pass with no secret; confidential ones must send theirs. */
  async authenticateClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | null> {
    const [row] = await this.db.select().from(r.oauthClients).where(eq(r.oauthClients.clientId, clientId)).limit(1);
    if (!row) return null;
    if (row.secretHash && !(clientSecret && same(sha256(clientSecret), row.secretHash))) return null;
    return { clientId: row.clientId, name: row.name, redirectUris: row.redirectUris, confidential: !!row.secretHash };
  }

  // ---- authorization codes ----

  async createCode(input: { clientId: string; userId: string; redirectUri: string; codeChallenge: string; scope?: string; resource?: string | null }): Promise<string> {
    const code = secret();
    await this.db.insert(r.oauthCodes).values({
      codeHash: sha256(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope ?? "",
      resource: input.resource ?? null,
      expiresAt: at(CODE_SECONDS),
    });
    return code;
  }

  async exchangeCode(input: { code: string; clientId: string; redirectUri: string; codeVerifier: string }): Promise<TokenSet | OAuthError> {
    const hash = sha256(input.code);
    const [row] = await this.db.select().from(r.oauthCodes).where(eq(r.oauthCodes.codeHash, hash)).limit(1);
    const bad = (d: string): OAuthError => ({ error: "invalid_grant", error_description: d });
    if (!row || row.clientId !== input.clientId) return bad("Unknown authorization code.");
    if (row.usedAt) {
      // A replayed code: revoke everything it issued (OAuth 2.1 section 4.1.3).
      await this.revokeFor(row.userId, row.clientId);
      return bad("This authorization code was already used.");
    }
    if (row.expiresAt < at()) return bad("The authorization code expired.");
    if (row.redirectUri !== input.redirectUri) return bad("redirect_uri does not match the authorization request.");
    if (!input.codeVerifier || !same(sha256(input.codeVerifier), row.codeChallenge)) return bad("PKCE code_verifier does not match.");
    const claimed = await this.db
      .update(r.oauthCodes)
      .set({ usedAt: at() })
      .where(and(eq(r.oauthCodes.codeHash, hash), isNull(r.oauthCodes.usedAt)))
      .returning({ h: r.oauthCodes.codeHash });
    if (!claimed.length) return bad("This authorization code was already used.");
    return this.issue(row.clientId, row.userId, row.scope);
  }

  async refresh(input: { refreshToken: string; clientId: string }): Promise<TokenSet | OAuthError> {
    const hash = sha256(input.refreshToken);
    const [row] = await this.db.select().from(r.oauthTokens).where(eq(r.oauthTokens.tokenHash, hash)).limit(1);
    if (!row || row.kind !== "refresh" || row.clientId !== input.clientId || row.revokedAt || row.expiresAt < at()) {
      return { error: "invalid_grant", error_description: "The refresh token is invalid or expired. Connect again." };
    }
    const revoked = await this.db
      .update(r.oauthTokens)
      .set({ revokedAt: at() })
      .where(and(eq(r.oauthTokens.tokenHash, hash), isNull(r.oauthTokens.revokedAt)))
      .returning({ h: r.oauthTokens.tokenHash });
    if (!revoked.length) return { error: "invalid_grant", error_description: "The refresh token was already used." };
    return this.issue(row.clientId, row.userId, row.scope);
  }

  /** The account an access token belongs to, or null if it is unknown, expired or revoked. */
  async verifyAccessToken(token: string): Promise<{ userId: string; clientId: string; scope: string } | null> {
    const [row] = await this.db.select().from(r.oauthTokens).where(eq(r.oauthTokens.tokenHash, sha256(token))).limit(1);
    if (!row || row.kind !== "access" || row.revokedAt || row.expiresAt < at()) return null;
    return { userId: row.userId, clientId: row.clientId, scope: row.scope };
  }

  private async issue(clientId: string, userId: string, scope: string): Promise<TokenSet> {
    const access = secret();
    const refresh = secret();
    await this.db.insert(r.oauthTokens).values([
      { tokenHash: sha256(access), kind: "access", clientId, userId, scope, expiresAt: at(ACCESS_TOKEN_SECONDS) },
      { tokenHash: sha256(refresh), kind: "refresh", clientId, userId, scope, expiresAt: at(REFRESH_TOKEN_SECONDS) },
    ]);
    return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_SECONDS, refresh_token: refresh, scope };
  }

  private async revokeFor(userId: string, clientId: string): Promise<void> {
    await this.db
      .update(r.oauthTokens)
      .set({ revokedAt: at() })
      .where(and(eq(r.oauthTokens.userId, userId), eq(r.oauthTokens.clientId, clientId), isNull(r.oauthTokens.revokedAt)));
  }

  // ---- pending imports ----

  imports(): ImportStore {
    return {
      get: async (id) => (await this.db.select().from(r.pendingImports).where(eq(r.pendingImports.id, id)).limit(1))[0]?.data ?? null,
      set: async (id, value: PendingImport) => {
        await this.db.insert(r.pendingImports).values({ id, worldId: value.worldId, data: value, createdAt: at() });
      },
      delete: async (id) => {
        await this.db.delete(r.pendingImports).where(eq(r.pendingImports.id, id));
      },
      listForWorld: async (worldId) =>
        (await this.db.select().from(r.pendingImports).where(eq(r.pendingImports.worldId, worldId)).orderBy(r.pendingImports.createdAt)).map(
          (row) => [row.id, row.data] as [string, PendingImport],
        ),
    };
  }
}

/** Open the remote server's database: the story storage and the remote store on one connection pool. */
export async function openRemote(url: string): Promise<{ storage: PgStorage; remote: RemoteStore }> {
  const { db, close } = await openPgDb(url);
  return { storage: new PgStorage(db, close), remote: new RemoteStore(db) };
}
