# Continuity Engine — Build Spec for Claude Code

Nov 23, 2026 · @Parker

## How to use this with Claude Code

Export this doc as Markdown, save it in an empty repo as `SPEC.md`, and build one milestone at a time (see Build plan). Each milestone ends with acceptance checks; don't start the next until they pass.

Suggested first message to Claude Code:

> Read SPEC.md. Create a CLAUDE.md that summarizes the architecture, conventions and the current milestone. Then implement Milestone 1 only, with tests for its acceptance criteria. Ask me before changing anything in the spec.

Working rules for Claude Code:

- This spec is the source of truth. If code and spec disagree, stop and ask; don't silently change either.
- TypeScript throughout, strict mode. Tests with Vitest.
- Keep the storage layer behind one interface so the local file backend and the later database backend are swappable.
- Every write path goes through the rules engine (see Server-enforced rules). No tool writes to storage directly.

## Product summary

The Continuity Engine is a wiki and rules server that an AI game master reads before every scene and updates after it, so long interactive-fiction campaigns stop drifting. Claude connects to it over MCP and runs the game; the server stores the world, enforces canon rules, and hands Claude only the context each scene needs.

Goals for the MVP:

- Build a world with the AI (guided interview) or from uploaded files, and store it as an editable wiki.
- Run a campaign on top of that world with Claude, where every scene starts from the wiki and ends by logging tagged updates.
- Let the user edit any page at any time, approve or reject AI updates, and hide or show GM secrets with a toggle.
- Replace the in-chat ledger and copy-paste save blocks of the existing GM prompt. The wiki is the save.

The first user is the builder, running real campaigns. The MVP is done when a 10-scene test campaign keeps continuity measurably better than the same campaign without the wiki (see Evaluation).

## Decisions already made

| Topic | Decision | What it means for the build |
| --- | --- | --- |
| Users | Single user first; sharing with a party or co-authors later | Every world and campaign has an `owner_id` and a permissions table from day one, even with one row |
| Approval of AI writes | User chooses the mode at world and campaign creation; changeable anytime | Three modes plus a per-severity mixed mode (see Server-enforced rules) |
| User edits | Any wiki page is editable by the user at any time | User edits are rulings: top precedence, locked against AI overwrite, versioned, surfaced to the AI as "changed since last session" |
| GM secrets | Hidden behind a spoiler toggle, not hard-locked | Player view vs GM view; secret sections on ordinary pages, plus a `gm/` area |
| AI client | Claude through MCP | Local stdio MCP server first (Claude Desktop), then a remote server usable as a custom connector |
| Game rules | The existing GM prompt is the basis | Its storage duties move to the server; its storytelling rules stay in the prompt, split into modules |

## Architecture and stack

&#91;embedded content: system architecture · local MVP\]

Claude and the web app never touch storage directly; both go through `packages/core`, so every rule applies no matter who writes.

- **Language:** TypeScript (strict), Node 20+, pnpm workspaces.
- **MCP server:** the official TypeScript MCP SDK, stdio transport for Claude Desktop in the MVP; a streamable HTTP transport is added in Milestone 8.
- **Storage:** SQLite (better-sqlite3) through Drizzle ORM, FTS5 for search. One database file per install.
- **Web app:** Next.js with server actions calling `packages/core`; Tailwind.
- **Validation:** Zod for every tool input and every stored JSON field.
- **Tests:** Vitest. The rules engine has the most coverage.

## Data model

Store everything in SQLite through Drizzle ORM, with a schema that ports to Postgres unchanged when the server goes remote. Page bodies are Markdown strings inside the database. A Markdown export (and import) of a whole world or campaign is a required feature, not an afterthought.

Two layers: **world** rows hold shared canon; **campaign** rows hold one playthrough. When a campaign row and a world row cover the same thing, the campaign row wins for that campaign.

| Table | Key fields | Notes |
| --- | --- | --- |
| `users` | id, name | One row for now |
| `permissions` | subject\_type (world, campaign), subject\_id, user\_id, role (owner, editor, player, viewer) | Only `owner` is used in the MVP |
| `worlds` | id, owner\_id, name, pitch, depth (compact, full), default\_approval\_mode |  |
| `campaigns` | id, world\_id, owner\_id, name, settings (JSON: genre, tone, difficulty, length, pacing, dice, turn length, content lines and veils), approval\_mode, severity\_policy, as\_of\_story\_time, current\_chapter, spoilers\_on, last\_session\_at | Settings mirror the GM prompt's intake answers |
| `entities` | id, world\_id, campaign\_id (null = world canon), type, slug, name, aliases\[\], source (canon, ruling, invention, unverified), summary | `type`: character, place, faction, item, event, concept, rule. `summary` = the short current-state block the AI reads first |
| `sections` | id, entity\_id, campaign\_id (null = world), key, heading, body\_md, visibility (public, secret), order, locked\_by\_user | A campaign section with the same `key` overrides the world section in that campaign |
| `updates` | id, campaign\_id, seq, entity\_ids\[\], tags\[\], type, severity (minor, major), status (proposed, confirmed, rejected, retconned, superseded), story\_time, chapter, scene\_id, body\_md, supersedes\_id, author (ai, user) | The tagged log entries written after scenes |
| `knowledge` | holder\_entity\_id, target\_type (update, section), target\_id | Who knows what. Drives the player-view filter |
| `rulings` | id, world\_id, campaign\_id, text (verbatim), origin (in\_play, user\_edit), created\_at | Highest precedence |
| `threads` | id, campaign\_id, title, body\_md, state (open, resolved), tags\[\], opened\_chapter, resolved\_chapter | Plot threads, promises, debts, planted details |
| `chapters` | id, campaign\_id, number, title, summary\_md, closed\_at |  |
| `scenes` | id, campaign\_id, chapter, number, place\_entity\_id, present\_entity\_ids\[\], summary\_md, started\_at, logged\_at | `logged_at` null = scene never logged |
| `gm_notes` | id, campaign\_id, kind (design, clock, twist, ending, setup, motif), key, body\_md, data (JSON) | Clocks store `{step, steps, advances_on}`. Hidden unless spoilers are on |
| `voice_anchors` | campaign\_id, sample\_verbatim, profile\_md, interior\_level, avoid\_list\[\], voice\_rulings\[\], scenes\_since\_audit | Changes only through user edits or logged voice rulings |
| `pc_sheets` | campaign\_id, data (JSON: name, stats, health, stress, inventory, bonds, trackers, flaw notes) |  |
| `sessions` | id, campaign\_id, opened\_at, closed\_at | One per chat session, opened by `open_campaign` |
| `reads` | session\_id, entity\_id, read\_at | Powers read-before-write |
| `versions` | id, object\_type, object\_id, before, after, author (ai, user), edit\_kind (retcon, forward, null), reason, created\_at | Written on every change. Powers undo, history and the change feed |

Indexes: `entities(world_id, slug)` unique; `entities.aliases` searchable (SQLite FTS5 over name, aliases, summary and section bodies).

## Page format and export layout

The database is the source of truth. This folder layout is the Markdown export and import format, and it's how pages are shown to Claude.

```
worlds/<world-slug>/
  00-load-guide.md        generated: what exists, where, when to load it
  setting/                overview, history, magic-or-tech, geography
  factions/  places/  characters/  items/
  glossary.md             slang, oaths, forms of address
  timeline.md
campaigns/<campaign-slug>/
  campaign.md             premise, settings, boundaries, as-of moment
  voice-anchor.md
  rulings.md
  pc.md                   sheet, trackers, inventory
  overlays/               campaign sections that override world pages
  threads.md
  chapters/ch-01.md ...
  log/0001.md ...         one file per update
  gm/                     design, clocks, twists (spoiler-gated)
```

An entity page has front matter for structured fields and `##` sections for prose. Sections marked `secret` are hidden in player view.

```markdown
---
id: rickard-snow
type: character
name: Rickard Snow
aliases: [Snow, the bastard sellsword, Commander]
source: invention
locked_sections: [appearance]
---
## Summary
Sellsword captain, Golden Company, outside Volantis. Wounded left shoulder (ch-12).

## Appearance
...

## Wants
...

## Hiding  <!-- visibility: secret -->
His mother's name, and why it matters in Volantis.
```

An update entry, as written after a scene:

```markdown
---
seq: 147
entities: [rickard-snow, golden-company]
tags: [volantis, ch-12]
type: status-change
severity: major
status: proposed
story_time: 3rd day after the siege
scene: ch-12-s4
supersedes: 98
knows: [marro, surgeon-yezzan]
author: ai
---
Rickard took a crossbow bolt to the left shoulder during the retreat.
He can't draw a bow until it heals. Only Marro and the surgeon know how bad it is.
```

Tag rules: lowercase kebab-case only. Entity tags must match an existing entity slug or alias, which the server resolves to the canonical slug. Time tags use `ch-NN`. The allowed `type` values are a fixed list: new-fact, status-change, relationship, location, item, knowledge, death, faction-shift, world-rule.

## MCP tools

Few, chunky tools, so a turn costs one or two calls. Every tool returns compact Markdown for Claude to read plus a small JSON status. Every write returns what was stored and its status (proposed or confirmed), so Claude never assumes a write landed as canon.

**Setup and worldbuilding**

| Tool | Inputs | Returns | Rules |
| --- | --- | --- | --- |
| `list_worlds` | none | Worlds and their campaigns |  |
| `create_world` | name, pitch, depth, approval\_mode | World id, empty load guide | Asks nothing itself; the prompt runs the interview |
| `create_entity` | world\_id, campaign\_id?, type, name, aliases, source, sections\[\] | The stored page | Rejects if the name or an alias matches an existing entity; returns the match instead |
| `edit_entity` | entity\_id, section edits, summary? | The stored page | Refused on sections locked by the user. Requires a read this session |
| `import_document` | world\_id, title, proposed entities\[\] (Claude's split of the file) | Import id, likely duplicates, disagreements with existing pages | Nothing is written until `confirm_import` |
| `confirm_import` | import\_id, accepted items | Created entity ids |  |
| `create_campaign` | world\_id, name, settings, approval\_mode, severity\_policy | Campaign id |  |
| `set_voice_anchor` | campaign\_id, sample, profile, interior\_level, avoid\_list | Stored anchor | Only during intake; later changes go through `record_ruling` with kind `voice` |

**Play**

| Tool | Inputs | Returns | Rules |
| --- | --- | --- | --- |
| `open_campaign` | campaign\_id | Settings, as-of moment, approval mode, voice anchor, pinned context, PC sheet, current chapter, open threads, every ruling, this chapter's logged scenes, **changed since last session**, any unlogged scene | Opens a new session. Must be the first call of every chat |
| `get_context` | campaign\_id, present\[\], place?, threads\[\]? | Summaries for each present entity and the place, latest confirmed and proposed updates for them, what each present character knows, related rulings | Logs each returned entity as read. Resolves aliases |
| `read_entity` | entity\_id or name | Full page (secret sections only if spoilers on, or always for the GM's own use, see Spoiler model) | Logs a read |
| `search_wiki` | query, type? | Matching entities with one-line summaries | Full-text over names, aliases, summaries, sections |
| `log_scene` | campaign\_id, summary, present\[\], place, updates\[\], thread\_changes\[\], pc\_changes? | Stored scene, each update with its resulting status, any refusals | Main write path. Partial success allowed: each update is accepted or refused on its own |
| `close_chapter` | campaign\_id, title, summary | A checklist: entities whose summaries need refreshing, clocks to advance, voice audit due | Claude then calls `edit_entity` and `gm_write` to work through it |
| `record_ruling` | campaign\_id, text, kind (canon, voice, character\_inner\_life) | Stored ruling | Verbatim text. Top precedence |
| `update_campaign` | campaign\_id, settings?, as\_of?, pc\_sheet? | Stored settings and PC sheet | Merges into what is stored. For the PC sheet at character creation, the as-of moment, and `(OOC) settings` changes; sheet changes during a scene go in `log_scene` |
| `gm_read` | campaign\_id | Story design, clocks, twists, endings |  |
| `gm_write` | campaign\_id, kind, key, body, data? | Stored note | Clock changes are logged in `versions` |

Schemas: define every input with Zod and generate the MCP JSON schema from it. Tool descriptions carry the protocol for when to call each tool, in one or two sentences each.

## Server-enforced rules

These live in one rules module that every write passes through. They're what make the server better than the prompt's honor system, so each needs unit tests.

**Read before write.** An update or edit that touches an entity is refused unless that entity was read in the current session (via `get_context` or `read_entity`). The refusal message tells Claude which entity to read.

**Alias resolution.** Every entity reference (tags, `present`, `knows`) is resolved to a canonical slug through names and aliases. An unknown reference is refused with the closest matches, never auto-created.

**Precedence.** When the server assembles context, sources rank: user edits and rulings, then campaign sections and confirmed updates, then world sections, then proposed updates, then `unverified` pages. A lower source never hides a higher one. Proposed and unverified material is always labeled as such in what Claude reads.

**Approval modes** (chosen per world and per campaign, changeable anytime):

| Mode | What happens to an AI write |
| --- | --- |
| Review everything | Stored as `proposed`; not canon until the user approves |
| Batch review | Stored as `proposed`, usable in play right away, labeled as soft; user approves in batches |
| Autopilot | Stored as `confirmed` |
| Mixed (by severity) | `minor` follows one mode, `major` another. Default: minor on autopilot, major in batch review |

The AI sets severity on each update. The server forces `major` for these types: death, knowledge (a secret spreading), faction-shift, world-rule.

**User locks.** Any section or field the user edits gets `locked_by_user`. AI writes to it are refused; the AI may instead log an update proposing a change, which the user sees next to the locked text.

**Conflicts.** A proposed update that contradicts a confirmed fact or a ruling isn't merged. It's parked with status `proposed` and a `conflicts_with` link, and shows at the top of the review queue. For the MVP, "contradicts" means it supersedes or edits something user-locked or confirmed and of `major` severity. Semantic contradiction detection is out of scope.

**Retcon or going forward.** When the user edits a fact, the web app asks which they mean. The edit is stored with `edit_kind: retcon` or `edit_kind: forward`, and the change feed tells Claude: a retcon means "this was always true; don't explain it," and forward means "this changed in the story; account for it in the fiction if it matters."

**Change feed.** `open_campaign` returns every user-authored version since the last session closed, grouped by entity, with the edit kind. The prompt treats this as overriding anything Claude remembers from the chat.

**Unlogged scenes.** If the last scene has no `logged_at`, `open_campaign` and `get_context` both return a warning asking Claude to log it before narrating.

**History.** Every change writes a `versions` row. Any version can be restored from the web app. Nothing is hard-deleted in the MVP; rejected and retconned updates stay as records.

## Phase 0: building the world

Worldbuilding happens in the Claude chat, driven by the worldbuilding prompt module, and every result lands in the wiki. It starts by asking two things: which path (below, freely combined), and which approval mode to use while building. Nothing the AI drafts in Phase 0 becomes canon without passing that approval mode.

**A. Guided interview.** The user picks a depth: compact (about the GM prompt's current setting sheet) or full bible. The AI then works through these steps, writing pages after each one and showing them for approval. Any step can be skipped and revisited.

1. Pitch and pillars: premise, tone, themes → `setting/overview`
2. Power and social order → `setting/society`
3. Geography → `places/*`
4. History, down to the present → `timeline`
5. Factions (3 to 8): aims, assets, enemies → `factions/*`
6. Magic or technology: what it does, costs, limits → `setting/magic-or-tech`
7. Culture: slang, oaths, forms of address, customs → `glossary`
8. Key figures → `characters/*`
9. The as-of moment → stored on the world as the default starting point

**B. Import.** The user drops files into the Claude chat. Claude reads each one, splits it into proposed entities (names, aliases, sections), and calls `import_document` with that split. The server never calls a model itself in the MVP: it checks the split against the wiki and returns likely duplicates and fields where the file disagrees with existing pages. Claude adds the gaps it noticed, shows the user the summary, and `confirm_import` writes only what they accept. Imported material gets `source: canon`.

**C. Established universe.** For a published setting, Claude may draft skeleton pages from its own knowledge, but each is stored with `source: unverified`. Unverified pages are usable in play and always labeled in context. The user upgrades them to canon as they check them, or Claude does so after the user confirms a fact.

Phase 0 ends when the user says the world is ready. The load guide is regenerated automatically after every write, so it is never stale.

## Spoiler model

Secrets are hidden by a toggle, not locked. The toggle controls what the web app shows the user; Claude always reads the GM view, because it needs secrets to run the game.

| View | Shows | Used by |
| --- | --- | --- |
| Player view (spoilers off) | Public sections; updates and sections the player character knows (`knowledge` rows with the PC as holder); no `gm/` notes | The web app by default, and `(OOC) ledger` / `(OOC) canon` answers |
| GM view (spoilers on) | Everything: secret sections, all updates, `gm/` notes, clocks | Claude's tool calls always; the web app when the toggle is on |

Where secrets live: secret sections on ordinary pages (an NPC's "Hiding" section), updates whose `knows` list excludes the PC, and everything in `gm_notes`.

One honest limit: tool results are expandable in Claude's chat UI, so a determined player can read secrets there too. That's consistent with the toggle decision. To reduce accidental spoilers, `get_context` and `read_entity` put secret material in a clearly labeled final block (`GM ONLY`) so it's easy not to read.

The tools also return a ready-made player-view answer for `(OOC) ledger` and `(OOC) canon` requests (a `view: player` parameter on `read_entity` and `search_wiki`), so Claude doesn't have to filter secrets by hand when answering out of character.

## GM prompt refactor

The existing GM prompt keeps its storytelling rules and loses its storage duties. Split it into four Markdown files in `prompts/`, kept in the repo and pasted into a Claude Project's instructions for testing.

| Module | Contents from the current prompt | Loaded |
| --- | --- | --- |
| `00-protocol.md` | New: when to call each tool (below) | Always |
| `10-worldbuilding.md` | New: Phase 0 paths A, B, C; replaces the original-world setting sheet | Phase 0 |
| `20-intake.md` | Phases 1 and 2, hidden story design | New campaign |
| `30-play.md` | Priority order, narration, interior voice, voice audit, companions, mechanics, OOC commands | Play |

Remove from the prompt, because the server now does it: quietly maintaining the ledger, restating it at chapter end, tracking which files were read, the load-guide lookup, and both save blocks. Change `(OOC) save` to: confirm the last scene is logged and say the campaign is saved. Point `(OOC) ledger`, `recap`, `rulings`, `sheet` and `canon` at the tools (player view where the prompt limits answers to what the character knows).

Draft of `00-protocol.md` for Claude Code to commit and refine:

```markdown
# Wiki protocol
The wiki is the record of this game. When the wiki and your memory of this chat disagree, the wiki wins.

1. First call in every chat: open_campaign. Read its "changed since last session" list before anything else.
   A retcon means it was always so; don't explain it. A forward change happened in the story; account for it if it matters.
   If it reports an unlogged scene, log it before narrating.
2. Before each scene: get_context with everyone present, the place, and the threads in play.
3. The first time a character, place or faction appears this session and wasn't in get_context: read_entity first.
4. Narrate. Facts about people, places and the world come from what you read this session, from rulings, or are new inventions.
5. When a scene ends: log_scene with a summary and one update per change. Tag every entity, set severity, list who knows.
   Log inventions too, so they stay fixed.
6. When the user makes a ruling in play: record_ruling with their words.
7. At chapter end: close_chapter, then work through its checklist (summaries, clocks, voice audit).
8. Proposed updates are soft canon. Prefer confirmed facts when the two conflict.
9. Never show GM ONLY material to the player unless spoilers are on and they ask.
```

## Web app screens

A local Next.js app reading the same SQLite file as the MCP server, through the same storage and rules modules. It's for humans: browsing, editing, reviewing. No chat in the MVP.

| Screen | What it does |
| --- | --- |
| Home | Worlds and their campaigns; create, export or import |
| Wiki browser | Entities grouped by type, full-text search, filter by source (canon, ruling, invention, unverified) |
| Entity page | Sections with inline editing, lock icons on user-edited sections, public/secret toggle per section, aliases, the updates that touch this entity, version history with restore |
| Edit confirm | On saving a fact change: "Retcon (always true)" or "Change from now on" |
| Review queue | Proposed updates, conflicts pinned on top; approve, edit, reject each; bulk-approve all minor updates |
| Campaign dashboard | Settings, approval mode and severity policy, spoiler toggle, PC sheet, open threads, chapter summaries, rulings |
| GM notes | Story design, clocks and twists, visible only with spoilers on |

The spoiler toggle sits in the top bar on every campaign screen and defaults to off. Styling: a plain, readable layout is enough for the MVP; Tailwind with a reading-friendly serif for page bodies.

## Build plan

Seven milestones to a usable MVP, then one to go remote. Each ends with checks that must pass before the next starts.

**Milestone 1: Storage core**

Scaffold a pnpm monorepo: `packages/core` (schema, storage, rules), `apps/mcp`, `apps/web`. Add the Drizzle schema and migrations, the storage interface, a `versions` row on every write, alias resolution, FTS5 search, and Markdown export and import.

- [ ] Tests create a world, entities with aliases, and sections; an alias resolves to its canonical slug
- [ ] Every write produces exactly one `versions` row
- [ ] Export then import of a world round-trips with no differences

**Milestone 2: Rules engine**

Sessions and reads, read-before-write, approval modes and severity policy, forced-major types, user locks, conflict parking, change feed with edit kinds, unlogged-scene detection, precedence ordering for context assembly.

- [ ] One passing unit test per rule in Server-enforced rules, covering both the allowed and refused path
- [ ] A write refused by a rule changes nothing in storage

**Milestone 3: MCP server (local)**

A stdio MCP server exposing every tool in MCP tools, with Zod schemas, compact Markdown results, and the `GM ONLY` block. Document how to add it to Claude Desktop in the README.

- [ ] From Claude Desktop: create a world and entities, open a campaign, get context, log a scene
- [ ] A refusal (unread entity, locked section, unknown alias) shows Claude a message that says how to fix it

**Milestone 4: Prompt modules**

Write the four modules in `prompts/` from the existing GM prompt, as described in GM prompt refactor. Play one short chapter by hand.

- [ ] Every scene in the chapter was logged without a reminder
- [ ] A new chat resumes the campaign from `open_campaign` alone, with no save block

**Milestone 5: Web app**

The screens in Web app screens, using `packages/core` directly.

- [ ] Editing a section locks it, and an AI write to it is then refused
- [ ] A user edit appears in the next `open_campaign` change feed with its edit kind
- [ ] Approving in the review queue flips the update to confirmed; restore from history works
- [ ] Spoiler toggle off hides secret sections, `gm/` notes, and updates the PC doesn't know

**Milestone 6: Phase 0 flows**

The worldbuilding module and the import tools.

- [ ] A compact world built entirely by interview, every page approved
- [ ] A multi-file world bible imported, with duplicates and disagreements flagged before confirm
- [ ] An established-universe skeleton stored as `unverified` and labeled in context

**Milestone 7: Evaluation**

The continuity test in Evaluation, run and written up.

- [ ] Results recorded in `eval/RESULTS.md`, with and without the wiki

**Milestone 8 (after the MVP): Remote**

Postgres (Supabase), user accounts with OAuth, a remote MCP endpoint usable as a Claude custom connector, deployment, and per-user permissions put to real use.

## Evaluation

The MVP works if a wiki-backed campaign makes clearly fewer continuity errors than the same campaign without it.

1. Pick one real campaign and write `eval/facts.md`: 20 facts the GM must honor later (injuries, deaths, debts, secrets and who knows them, items, promises).
2. Seed the facts into the wiki, or establish them in early scenes.
3. Run 10 scenes designed to tempt each fact (the wounded character is asked to fight; a dead NPC's ally appears; someone who shouldn't know a secret is present).
4. Run the same 10 scene prompts in a plain Claude chat with only the original GM prompt and its in-chat ledger.
5. Score both runs per fact: honored, violated, or not tested. Also count scenes that ended unlogged and updates refused by the rules engine.

Record results in `eval/RESULTS.md`. Keep the scene prompts in `eval/scenes/`, so the test can be rerun after prompt or tool changes.

## Out of scope and open questions

Not in the MVP:

- Sharing, parties and co-authors (the permissions table exists, unused)
- Semantic contradiction detection (only structural conflicts are caught)
- A chat interface inside the web app, and support for models other than Claude
- Timeline and relationship-graph views
- Mobile app
- The server calling any model itself (summaries and imports are done by Claude through tools)

Open questions:

- [ ] How long can `get_context` results get before they slow turns down? Set a token budget after Milestone 4 play testing.
- [ ] Should summary pages be refreshed only at chapter close, or also when an entity gets three or more confirmed updates?
- [ ] Pricing and packaging, once the remote server exists: free tier limits, and whether to ship the GM prompt as a Claude skill.
