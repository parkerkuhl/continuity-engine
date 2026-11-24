# Continuity Engine MCP server

A local stdio MCP server that gives Claude the Continuity Engine tools (SPEC.md, "MCP tools"). Claude Desktop starts it; it stores everything in one SQLite file.

## Build

From the repository root:

```sh
pnpm install
pnpm --filter @continuity/mcp build
```

This writes `apps/mcp/dist/bin/server.js` (with its migrations in `apps/mcp/dist/drizzle`). Rebuild after pulling changes.

## Add it to Claude Desktop

1. Open Claude Desktop, then **Settings → Developer → Edit Config**. This opens `claude_desktop_config.json`
   (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`).
2. Add the server under `mcpServers`, using the absolute path to your clone:

   ```json
   {
     "mcpServers": {
       "continuity-engine": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/continuity-engine/apps/mcp/dist/bin/server.js"],
         "env": { "CONTINUITY_DB": "/ABSOLUTE/PATH/TO/continuity.db" }
       }
     }
   }
   ```

   `CONTINUITY_DB` is optional; the default is `~/.continuity-engine/continuity.db`. Node 20 or newer must be on the PATH Claude Desktop sees; if it isn't, use the full path to `node` as `command`.
3. Quit and reopen Claude Desktop. The tools appear under the tools (hammer) menu as `continuity-engine`.

If the server doesn't show up, check Claude Desktop's MCP log (`~/Library/Logs/Claude/mcp-server-continuity-engine.log` on macOS). The server writes its startup line and errors to stderr, which goes to that log.

## Try it

In a new chat, ask Claude to:

1. Create a world (`create_world`) and a few characters and a place (`create_entity`).
2. Create a campaign (`create_campaign`), then open it (`open_campaign`).
3. Get context for a scene with those characters present (`get_context`).
4. Narrate a short scene and log it (`log_scene`) with an update or two.

Every write reports what was stored and whether it is `confirmed` or `proposed`. Refusals (an entity not read this session, a section you locked, an unknown name) explain how to fix the call.

## Notes

- `open_campaign` must be the first call of every chat. The server keeps one open session per campaign for as long as it runs; play tools find it by `campaign_id`, and `read_entity`, `edit_entity` and `search_wiki` use it automatically when only one campaign is open.
- Secret sections and GM notes are always in a final `GM ONLY` block. `read_entity` and `search_wiki` take `view: "player"` for out-of-character answers.
- Imports from `import_document` are held in memory until `confirm_import`; restarting the server drops unconfirmed imports.
- For development without building: `pnpm --filter @continuity/mcp dev` runs the source with tsx.
