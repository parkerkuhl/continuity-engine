// Starts the built MCP server (apps/mcp/dist) over stdio on a given database, the way Claude Desktop does.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repo = join(here, "..", "..");
const bundle = join(repo, "apps/mcp/dist/bin/server.js");

export async function connectMcp(db) {
  if (!existsSync(bundle)) throw new Error("Build the MCP server first: pnpm --filter @continuity/mcp build");
  const client = new Client({ name: "continuity-eval", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bundle], env: { ...process.env, CONTINUITY_DB: db }, stderr: "ignore" }));
  /** Calls a tool; returns its Markdown text, JSON status and error flag. */
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const text = r.content.map((c) => c.text ?? "").join("\n");
    let status = {};
    try {
      status = r.content[1] ? JSON.parse(r.content[1].text) : {};
    } catch {}
    return { text, status, isError: !!r.isError };
  };
  return { client, call, close: () => client.close() };
}
