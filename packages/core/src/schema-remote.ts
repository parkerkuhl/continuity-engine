/**
 * Tables only the remote server uses (Milestone 8), Postgres only. They are infrastructure, not story
 * content: no `versions` rows, nothing exported. OAuth codes and tokens are stored as SHA-256 hashes.
 */
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { PendingImport } from "./rules/engine";

/** Clients registered through OAuth dynamic client registration (Claude's custom connector registers itself). */
export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  /** SHA-256 of the client secret, for clients that asked for client_secret_post or client_secret_basic. */
  secretHash: text("secret_hash"),
  name: text("name").notNull().default(""),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: text("created_at").notNull(),
});

/** One-time authorization codes (PKCE S256), valid for ten minutes. */
export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull(),
  userId: text("user_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scope: text("scope").notNull().default(""),
  resource: text("resource"),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

/** Access tokens (one hour) and refresh tokens (30 days, rotated on use). */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    kind: text("kind", { enum: ["access", "refresh"] }).notNull(),
    clientId: text("client_id").notNull(),
    userId: text("user_id").notNull(),
    scope: text("scope").notNull().default(""),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("oauth_tokens_user").on(t.userId)],
);

/** import_document results waiting for confirm_import (the remote server keeps no memory between requests). */
export const pendingImports = pgTable(
  "pending_imports",
  {
    id: text("id").primaryKey(),
    worldId: text("world_id").notNull(),
    data: jsonb("data").$type<PendingImport>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("pending_imports_world").on(t.worldId)],
);
