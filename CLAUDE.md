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
| `src/rules/` | Rules engine (`engine.ts`), precedence and context assembly (`precedence.ts`), refusal values (`result.ts`), web read models and the player view (`views.ts`) |

### apps/mcp layout

| Path | What it holds |
| --- | --- |
| `src/server.ts` | `createServer(engine)`: registers every SPEC tool (19) with Zod input schemas; keeps one open session per campaign |
| `src/render.ts` | Compact Markdown for each result; secrets go in a final `GM ONLY` block |
| `src/index.ts` | stdio entry point (`CONTINUITY_DB`, default `~/.continuity-engine/continuity.db`) |
| `build.mjs` | esbuild bundle to `dist/bin/server.js`, migrations copied to `dist/drizzle` |
| `README.md` | Build and Claude Desktop setup |

### apps/web layout

| Path | What it holds |
| --- | --- |
| `lib/server.ts` | The one `RulesEngine` + `WebViews` per process, on `CONTINUITY_DB`; world and campaign scopes |
| `app/actions.ts` | Server actions; each calls `RulesEngine` or `WebViews` only |
| `app/` | Routes: `/` home, `/w/[worldId]` world wiki (plus `review` for drafted pages), `/c/[campaignId]` dashboard, `wiki`, `e/[slug]`, `review`, `gm` |
| `components/` | App shell (dark sidebar; top bar with search and the Player view / GM view spoiler switch), wiki browser, entity view, inline editor with the edit-confirm dialog, update cards. Styling follows Parker's UI design: tokens in `app/globals.css`, Inter and Source Serif 4 self-hosted via @fontsource |
| `e2e/run.mjs` | Browser run of the M5 acceptance checks and the M6 page review against the real MCP server and `next start` |

## Conventions

- **Writes:** every `Storage` write method takes a `WriteMeta` (`author: ai | user`, optional `editKind: retcon | forward`, optional `reason`) and runs in one transaction that also inserts exactly one `versions` row. A failed write rolls back and leaves no `versions` row.
- **Slugs and tags:** lowercase kebab-case. Entity slugs are unique per world. Section keys are unique per entity and layer; `summary` is reserved (it maps to the entity's `summary` field).
- **Section bodies** are Markdown and may not contain a level-2 heading (`## `) outside a code fence, because `##` delimits sections in the page format. Use `###` or deeper.
- **Alias resolution:** a reference (slug, name, alias or id) is slugified and matched against each entity's slug, name and aliases in the world plus the given campaign. Unknown references return the closest matches and are never auto-created. Two matches return `ambiguous`.
- **Export layout** (SPEC "Page format and export layout"): `worlds/<world-slug>/00-load-guide.md` is generated and carries the world's own fields in its front matter. Entities go to `characters/`, `places/`, `factions/`, `items/`, `setting/` (concept and rule), and `events/` (event). Concept entities with slug `glossary` or `timeline` go to the world root as `glossary.md` and `timeline.md`.
- **Bookkeeping is not content:** sessions, reads and `campaigns.last_session_at` (all written by `openSession`/`recordReads`/`closeSession`) and the FTS index write no `versions` row.
- **Rules engine** (`src/rules/`): `RulesEngine` checks every rule before writing anything. AI calls carry a session id from `openCampaign`; user calls are the web app's. AI page edits during play apply directly to the page (an existing section is changed where it lives; a new section joins the entity's own layer), and every change, AI or user, shows in `RulesEngine.changelog` (built from `versions`). Tags are a fixed set of types for now: a `ch-NN` time tag or an entity (character, place, faction, item, event, concept, rule); `log_scene` results report each tag's type. Free-form tags are planned for later. `updates.conflicts_with` (added in M2 with Parker's OK; not yet in the SPEC data model table) links a parked update to the update or locked section it clashes with.
- **Player view** (`WebViews`, spoilers off): public sections, plus secret sections and updates with the PC (the entity named on the PC sheet) as a knower; no GM notes. A campaign keeps its toggle in `campaigns.spoilers_on`; world-only screens use a cookie. The review queue follows the toggle too.
- **Entity page outline** (`OUTLINES` in `views.ts`): each type has a standard list of sections (a character has Background, Appearance, Personality, Wants, Relationships, Inventory). It is a display aid only. A missing slot shows empty with a Write button, which goes through `addSection`, and nothing is stored until the user writes it. In a campaign, `WebViews.entity` also returns a `profile` built from play: relationship and item updates, co-appearances, what the entity knows, scenes, tagged threads, and the PC sheet. All of it follows the player view.
- **Page status** (M6, SPEC "Approval modes"): `entities.status` is proposed, confirmed or rejected. A page Claude creates follows its layer's approval mode (`pageStatusFor`: campaign mode with a new page as major; world default mode, mixed counting as review); `confirm_import` pages are confirmed. Proposed pages rank 4 and are labeled `PROPOSED PAGE`. The user approves or rejects them in the review queue (`RulesEngine.approvePage`/`rejectPage`); a rejected page keeps its row, gets a `-rejected-<id>` slug suffix and drops out of `listEntities`, resolution and search. `edit_entity` takes `world_id` while building a world (no session, no read needed; a changed confirmed page goes back to proposed) and `source` (never ruling). Worlds have `as_of_story_time` (`create_world`/`update_world` `as_of`); new campaigns start from it. `log_scene` `secrets_learned` writes section `knowledge` rows (`Storage.addSectionKnowers`).
- **Tests** live in `packages/core/test`, run against an in-memory database, and are named after the acceptance check they cover.

## Commands

```
pnpm install
pnpm test          # all packages
pnpm typecheck
pnpm --filter @continuity/core db:generate   # after changing src/schema.ts
pnpm --filter @continuity/mcp build          # bundle the MCP server for Claude Desktop
pnpm --filter @continuity/web dev            # web app on http://localhost:3100
pnpm --filter @continuity/web e2e            # browser acceptance run (build mcp and web first)
```

## Milestones

- [x] **Milestone 1, Storage core** (done 2026-11-23, PR #2): monorepo scaffold, Drizzle schema and migrations, storage interface, one `versions` row per write, alias resolution, FTS5 search, Markdown export and import of a world.
- [x] **Milestone 2, Rules engine** (done 2026-11-24, PR #3): sessions and reads, every server-enforced rule, changelog, tag types.
- [x] **Milestone 3, MCP server (local)** (accepted 2026-11-24, PR #4; Parker still runs the Claude Desktop check by hand): stdio server with every SPEC tool, `GM ONLY` block, README setup.
- [x] **Milestone 4, Prompt modules** (accepted 2026-11-24, PR #5; Parker still plays the test chapter by hand): the four modules in `prompts/`, plus `update_campaign` and a fuller `open_campaign` (SPEC.md updated with Parker's OK).
- [x] **Milestone 5, Web app** (accepted 2026-11-24, PR #6): Next.js app in `apps/web` with every SPEC screen, styled to Parker's UI design, plus a per-type entity outline and a profile drawn from play.
- [ ] **Milestone 6, Phase 0 flows** (current)
- [ ] Milestones 7 and 8: see SPEC "Build plan".

## Prompt modules (Milestone 4)

`prompts/` holds the GM prompt as four modules (SPEC "GM prompt refactor"): `00-protocol.md` (when to call each tool, always loaded), `10-worldbuilding.md` (Phase 0), `20-intake.md` (Phases 1 and 2, hidden story design), `30-play.md` (play rules and OOC commands). The storytelling rules come from Parker's GM prompt; its storage duties live in the server. Added in M4 with Parker's OK (SPEC.md updated): an `update_campaign` tool (settings, as-of moment, PC sheet outside a scene), and `open_campaign` also returns every ruling and this chapter's logged scenes. `close_chapter` restarts the voice-audit scene count, since the play module audits at every chapter opening. Every tool name, argument and enum value a module mentions in a code span must match `apps/mcp/src/server.ts`; `apps/mcp/test/m4-prompts.test.ts` checks this.

## Current milestone: Milestone 6, Phase 0 flows

Scope (SPEC "Phase 0: building the world"): the worldbuilding module and the import tools. Guided interview (path A), import of uploaded files with duplicates and disagreements flagged before `confirm_import` (path B), and established-universe skeletons stored as `unverified` and labeled in context (path C).

Acceptance checks:

- [x] A compact world built entirely by interview, every page approved
- [x] A multi-file world bible imported, with duplicates and disagreements flagged before confirm
- [x] An established-universe skeleton stored as `unverified` and labeled in context

Added in M6 with Parker's OK (SPEC.md updated): page status, `worlds.as_of_story_time`, the `update_world` tool, `edit_entity` `world_id` and `source`, and `log_scene` `secrets_learned`.
