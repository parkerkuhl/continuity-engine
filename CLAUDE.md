# CLAUDE.md

Guidance for Claude Code in this repo. `SPEC.md` is the source of truth; this file only summarizes it.

## Ground rules

- **Never edit `SPEC.md` without asking Parker first.** If code and spec disagree, stop and ask; don't silently change either.
- Build one milestone at a time. Don't start the next milestone until the current one's acceptance checks pass.
- TypeScript strict everywhere. Tests with Vitest. Zod for every tool input and every stored JSON field.
- The storage layer sits behind one interface (`Storage` in `packages/core/src/storage/types.ts`) so the SQLite backend and the later Postgres backend are swappable. Nothing outside `packages/core` touches the database.
- Every write path goes through the rules engine (Milestone 2). No MCP tool or web action writes to storage directly.
- Nothing is hard-deleted in the MVP. Every change writes exactly one `versions` row.

## What the product is

A wiki and rules server that an AI game master (Claude, over MCP) reads before every scene and updates after it, so long interactive-fiction campaigns keep continuity. The server stores the world, enforces canon rules, and hands Claude only the context each scene needs. A local web app lets the user browse, edit, review AI updates and toggle GM spoilers.

## Architecture

```
apps/mcp   (stdio MCP server, M3)  ─┐
apps/web   (Next.js, M5)           ─┼─> packages/core ──> SQLite (better-sqlite3 + Drizzle, FTS5)
                                    │     schema, storage interface, rules engine,
                                    │     alias resolution, search, Markdown export/import
```

- **Stack:** Node 20+, pnpm workspaces, TypeScript strict, Drizzle ORM over better-sqlite3, FTS5 for search, Zod, Vitest. Web is Next.js + Tailwind (M5). MCP uses the official TypeScript SDK (M3).
- **Two data layers:** world rows (`campaign_id` null) are shared canon; campaign rows belong to one playthrough and win over world rows for that campaign. A campaign section with the same `key` overrides the world section.
- **Schema portability:** the schema must port to Postgres unchanged. Ids are text UUIDs, timestamps are ISO strings, arrays and objects are JSON text validated by Zod.
- **Search:** `entities_fts` (FTS5) holds one row per entity over name, aliases, summary and all section bodies. Storage refreshes it inside the same transaction as each entity or section write. It is a derived index, not a "write" (no `versions` row).

### packages/core layout

| Path | What it holds |
| --- | --- |
| `src/schema.ts` | Drizzle schema for every table in SPEC "Data model" |
| `drizzle/` | Generated migrations (`pnpm --filter @continuity/core db:generate`), plus a hand-written one for FTS5 |
| `src/db.ts` | Opens a database file (or `:memory:`) and applies migrations |
| `src/enums.ts` | Zod enums and JSON field schemas shared by storage, rules and tools |
| `src/slug.ts` | `slugify` (lowercase kebab-case) and fuzzy matching helpers |
| `src/storage/types.ts` | The `Storage` interface. The only API the rest of the code uses |
| `src/storage/sqlite.ts` | SQLite implementation |
| `src/markdown/` | Entity page format (front matter + `##` sections) and world export/import |

## Conventions

- **Writes:** every `Storage` write method takes a `WriteMeta` (`author: ai | user`, optional `editKind: retcon | forward`, optional `reason`) and runs in one transaction that also inserts exactly one `versions` row. A failed write rolls back and leaves no `versions` row.
- **Slugs and tags:** lowercase kebab-case. Entity slugs are unique per world. Section keys are unique per entity and layer; `summary` is reserved (it maps to the entity's `summary` field).
- **Section bodies** are Markdown and may not contain a level-2 heading (`## `) outside a code fence, because `##` delimits sections in the page format. Use `###` or deeper.
- **Alias resolution:** a reference (slug, name, alias or id) is slugified and matched against each entity's slug, name and aliases in the world plus the given campaign. Unknown references return the closest matches and are never auto-created. Two matches return `ambiguous`.
- **Export layout** (SPEC "Page format and export layout"): `worlds/<world-slug>/00-load-guide.md` is generated and carries the world's own fields in its front matter. Entities go to `characters/`, `places/`, `factions/`, `items/`, `setting/` (concept and rule), and `events/` (event). Concept entities with slug `glossary` or `timeline` go to the world root as `glossary.md` and `timeline.md`.
- **Tests** live in `packages/core/test`, run against an in-memory database, and are named after the acceptance check they cover.

## Commands

```
pnpm install
pnpm test          # all packages
pnpm typecheck
pnpm --filter @continuity/core db:generate   # after changing src/schema.ts
```

## Current milestone: Milestone 1, Storage core

Scope: scaffold the monorepo (`packages/core`, `apps/mcp`, `apps/web`); the Drizzle schema and migrations; the storage interface; a `versions` row on every write; alias resolution; FTS5 search; Markdown export and import.

Acceptance checks:

- [ ] Tests create a world, entities with aliases, and sections; an alias resolves to its canonical slug
- [ ] Every write produces exactly one `versions` row
- [ ] Export then import of a world round-trips with no differences

Not in Milestone 1 (later milestones): sessions and reads, read-before-write and every other server-enforced rule (M2), MCP tools (M3), prompt modules (M4), web screens (M5), Phase 0 import flows (M6), evaluation (M7), remote/Postgres (M8).
