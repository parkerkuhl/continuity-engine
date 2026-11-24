# Building the world (Phase 0)

Load this module when the user wants a new world, or wants to add to one, before any campaign is played on it. Everything you build here lands in the wiki. Nothing stays only in the chat.

## Start

Ask two things, and nothing else, before you begin:

1. **Which path:** a guided interview (A), importing their files (B), or an established universe (C). They can combine them, for example importing a bible and then interviewing to fill the gaps.
2. **Which approval mode while building:** `review` (nothing is canon until they approve it), `batch` (usable now, approved in batches), `autopilot` (stored as confirmed), or `mixed` (by severity).

Then call `create_world` with the name, a one-line pitch, the depth (`compact` or `full`, for path A) and the approval mode. Call `list_worlds` first if the world may already exist; add to it rather than making a second one.

Show every page to the user before you store it, and store only what they accept. During Phase 0, a page you store is written as given, so the chat is where approval happens.

## A. Guided interview

Ask for the depth: **compact** (one short page per step, enough to start playing) or **full bible** (several pages per step, with sections). Then work through these steps in order. After each one, draft the pages, show them, revise until the user accepts, and store them with `create_entity` (source `canon` for what the user said or approved, `invention` for details you filled in that they waved through). Any step can be skipped and revisited; say which steps are still open when you finish.

| Step | Ask about | Store as |
| --- | --- | --- |
| 1. Pitch and pillars | Premise, tone, themes, what the world is about | concept named Overview |
| 2. Power and social order | Who rules, how, who is beneath them, what keeps it stable | concept named Society |
| 3. Geography | Regions, cities, the places play will start | one place per location |
| 4. History | The ages that matter, down to the present | concept named Timeline (exported as `timeline.md`) |
| 5. Factions (3 to 8) | Aims, assets, enemies, leaders | one faction each |
| 6. Magic or technology | What it does, what it costs, its limits | concept named Magic or Technology; each hard limit as its own rule |
| 7. Culture | Slang, oaths, forms of address, customs | concept named Glossary (exported as `glossary.md`) |
| 8. Key figures | People the story will meet, with what they want | one character each |
| 9. The as-of moment | When the story starts, and what is happening right then | a section "As of" on Overview |

Ask a few focused questions per step, offer two or three concrete options when the user is unsure, and keep your own inventions labeled as yours until they accept them.

Writing pages:

- **Summary** is the short current-state block a GM reads first: two to four sentences, present tense, as of the starting moment.
- **Sections** carry the detail. Use `###` or deeper inside a section body, never `##`.
- **Secrets** (a hidden allegiance, a lie the world believes) go in sections with `visibility: "secret"`, so the player view hides them.
- **Aliases:** add every name, title and nickname a character or place goes by, so later references resolve.
- If `create_entity` refuses because the name or an alias already exists, it returns the match. Use or extend that page instead of creating a duplicate.

## B. Import

When the user drops in files (a setting bible, notes, a wiki export):

1. Read each file fully. Split it into proposed entities: type, name, aliases, summary and sections. Put secret material in secret sections.
2. Call `import_document` with the world, the file's title and your split. Nothing is written yet. For several files, call it once per file, all before confirming any: each file is then checked against the others too.
3. Show the user what came back: likely duplicates of existing pages, fields where a file disagrees with the wiki (type, summary, sections), aliases a file adds, and items that appear in more than one file ("also in") with where those files disagree. Add the gaps you noticed (people mentioned but never described, places with no detail).
4. Ask which items to accept, and call `confirm_import` with their indexes, once per file. Accept only one version of an item that appears in several files. Accepted items are stored as `canon`; a duplicate of an existing page is refused, so to add a file's detail to an existing page, read it and use `edit_entity` once the user agrees.

Never resolve a disagreement yourself. The user decides which version is true.

## C. Established universe

For a published setting (a novel series, a game line, a film universe), you may draft skeleton pages from your own knowledge so play can start quickly. Store each one with source `unverified`; they are usable in play and always labeled UNVERIFIED in context.

- Draft only what you are confident of, and mark doubtful details as doubtful inside the page.
- Prefer fewer, accurate pages over many thin ones. The user can add more later.
- When the user confirms a fact, or corrects one, update the page with `edit_entity` and tell them it can now be marked canon. The user marks pages canon in the web app ("Checked: mark as canon").

## Finish

Phase 0 ends when the user says the world is ready. The load guide is regenerated after every write, so there is nothing to export or save. Tell the user which steps were skipped, then offer to start a campaign (the intake module).
