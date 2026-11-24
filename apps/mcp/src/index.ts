#!/usr/bin/env node
/**
 * stdio entry point for Claude Desktop. The database file is CONTINUITY_DB, or
 * ~/.continuity-engine/continuity.db by default. Logs go to stderr; stdout is the MCP channel.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RulesEngine, SqliteStorage } from "@continuity/core";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "./server";

const dbPath = process.env.CONTINUITY_DB || join(homedir(), ".continuity-engine", "continuity.db");
mkdirSync(dirname(dbPath), { recursive: true });

const storage = SqliteStorage.open(dbPath);
const server = createServer(new RulesEngine(storage));
await server.connect(new StdioServerTransport());
console.error(`continuity-engine MCP server ready (database: ${dbPath})`);

const shutdown = () => {
  storage.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
