# Continuity Engine web app

A local Next.js app for browsing and editing the wiki, reviewing Claude's updates, and toggling GM spoilers. It opens the same SQLite file as the MCP server and goes through `packages/core` for everything, so every rule applies to it the same way it applies to Claude.

## Run it

```
pnpm install
pnpm --filter @continuity/web build
pnpm --filter @continuity/web start      # http://localhost:3100
```

For development, `pnpm --filter @continuity/web dev` does the same with hot reload.

The database is `CONTINUITY_DB`, or `~/.continuity-engine/continuity.db` by default. That's the same default the MCP server uses, so the app shows whatever Claude has written. Both can run at once.

## Screens

| Screen | Path |
| --- | --- |
| Home: worlds and campaigns; create, export (.zip) or import | `/` |
| Wiki browser: pages by type, full-text search, filter by source | `/w/<world>` or `/c/<campaign>/wiki` |
| Entity page: inline editing, lock badges, public/secret per section, aliases, updates, history with restore | `.../e/<slug>` |
| Edit confirm: "retcon (always true)" or "change from now on" | appears when you save a change |
| Review queue: approve, edit, reject; bulk-approve minor updates; conflicts on top | `/c/<campaign>/review` |
| Campaign dashboard: approval mode and severity policy, settings, PC sheet, threads, chapters, rulings | `/c/<campaign>` |
| GM notes: story design, clocks, twists (spoilers on only) | `/c/<campaign>/gm` |

The spoiler toggle sits in the bar on every world and campaign screen and is off by default. With it off, the app shows the player view: secret sections, GM notes, and updates the PC doesn't know are hidden. Claude always reads the GM view, whatever the toggle says.

## End-to-end check

`e2e/run.mjs` seeds a world through the real MCP server, starts the built app on the same database, and runs the Milestone 5 acceptance checks in a browser. Screenshots go to `e2e/out/`.

```
pnpm --filter @continuity/mcp build && pnpm --filter @continuity/web build && pnpm --filter @continuity/web e2e
```

It needs Playwright with Chromium. Set `PLAYWRIGHT_PATH` if `playwright` isn't resolvable from Node.
