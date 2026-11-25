# Hosted version (Milestone 8)

One Next.js app (`apps/web`) serves the web app, the remote MCP endpoint for Claude's custom connector,
and the OAuth server the connector signs in through. It runs on Vercel against Postgres on Supabase.
The local setup (stdio MCP server plus SQLite, web app without sign-in) is unchanged: remote mode turns
on only when `CONTINUITY_DATABASE_URL` is set.

```
claude.ai custom connector ──OAuth 2.1──> /oauth/*  ─┐
                           ──Bearer────> /mcp        ├─> packages/core (scopeStorage per account) ──> Postgres (Supabase)
browser ──Supabase sign-in────────────> web screens ─┘
```

## Pieces

| Path | What it does |
| --- | --- |
| `packages/core/src/storage/pg.ts` | `PgStorage`: the `Storage` interface on Postgres (tsvector search instead of FTS5) |
| `packages/core/src/schema-pg.ts`, `drizzle-pg/` | Postgres schema (mirrors `schema.ts`; a test checks it) and migrations, run on first connect |
| `packages/core/src/storage/access.ts` | `scopeStorage(storage, userId)`: an account sees only worlds and campaigns it has a `permissions` row for |
| `packages/core/src/remote/store.ts` | OAuth clients, PKCE codes, rotating refresh tokens, and pending imports (`schema-remote.ts`) |
| `apps/web/app/mcp/route.ts` | Streamable HTTP MCP endpoint, stateless: open sessions are looked up in the database |
| `apps/web/app/.well-known/*`, `app/oauth/*` | Discovery (RFC 9728, RFC 8414), registration (RFC 7591), consent screen, token endpoint |
| `apps/web/middleware.ts`, `lib/auth.ts`, `app/login` | Supabase sign-in (email link; GitHub optional) |

## Environment (Vercel)

| Variable | Value |
| --- | --- |
| `CONTINUITY_DATABASE_URL` | Supabase session pooler URL for the `continuity_app` role (secret) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key |
| `CONTINUITY_PUBLIC_URL` | The production URL, e.g. `https://continuity-engine-pkuhl.vercel.app` |
| `CONTINUITY_PG_POOL` | `2` (connections per function instance) |
| `CONTINUITY_AUTH_GITHUB` | `1` to show "Sign in with GitHub" (turn the provider on in Supabase first) |

Vercel project settings: root directory `apps/web`, framework Next.js, "include files outside the root
directory" on. pnpm installs the workspace from the repo root.

## Database role

The app connects as its own role, with its tables in a `continuity` schema that Supabase's public API
doesn't expose:

```sql
CREATE ROLE continuity_app LOGIN PASSWORD '...';
GRANT continuity_app TO postgres;
CREATE SCHEMA continuity AUTHORIZATION continuity_app;
CREATE SCHEMA drizzle AUTHORIZATION continuity_app;
ALTER ROLE continuity_app SET search_path = continuity;
REVOKE ALL ON SCHEMA continuity FROM anon, authenticated, public;
```

## Supabase Auth settings

Authentication, URL Configuration: set **Site URL** to the production URL and add
`<production URL>/auth/callback` to **Redirect URLs**. Without this the sign-in email links to localhost.

Email sign-in uses Supabase's implicit flow, so a link works in any browser or device with the default
Magic Link template: Supabase puts the session in the URL fragment and `/auth/callback` posts it back to
itself. (A custom template may instead link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`;
the callback accepts that too. Supabase only lets you edit templates once custom SMTP is set up.)

## Adding the connector in Claude

Settings, Connectors, Add custom connector, URL `<production URL>/mcp`. Claude registers itself, opens the
consent screen (sign in first if asked), and then lists the tools. Load the prompt modules from `prompts/`
the same way as for Claude Desktop.

## Tests

```
pnpm --filter @continuity/core test:pglite                     # core suite on embedded Postgres
CONTINUITY_TEST_PG_URL=postgres://... pnpm --filter @continuity/core test:pg
pnpm --filter @continuity/web build
CONTINUITY_TEST_PG_URL=postgres://... pnpm --filter @continuity/web e2e:remote   # OAuth + /mcp + isolation, end to end
```
