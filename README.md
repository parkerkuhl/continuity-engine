# Continuity Engine

A wiki and rules server that an AI game master reads before every scene and updates after it, so long interactive-fiction campaigns stop drifting.

Claude connects to it over MCP and runs the game. The server stores the world, enforces canon rules, and hands Claude only the context each scene needs. A local web app lets you browse and edit the wiki, review AI updates, and toggle GM secrets.

## Status

Pre-alpha. Nothing is built yet. The full design lives in [SPEC.md](SPEC.md), which is the source of truth, and work proceeds one milestone at a time:

1. Storage core
2. Rules engine
3. MCP server (local, stdio)
4. Prompt modules
5. Web app
6. Phase 0 flows (worldbuilding and import)
7. Evaluation
8. Remote (after the MVP)

## Planned stack

TypeScript (strict) on Node 20+, pnpm workspaces, SQLite through Drizzle ORM with FTS5 search, the official TypeScript MCP SDK, Next.js with Tailwind, Zod for validation, and Vitest for tests.

## Planned layout

```
packages/core   schema, storage interface, rules engine
apps/mcp        MCP server (stdio first, HTTP later)
apps/web        Next.js app for browsing, editing and review
prompts/        GM prompt modules
eval/           continuity evaluation
```

Setup instructions, including adding the MCP server to Claude Desktop, will land with Milestone 3.
