// Milestone 4: the prompt modules in prompts/ must name only tools and arguments the MCP server really has,
// so a prompt can never tell Claude to call something that doesn't exist. (The milestone's own acceptance
// checks, "every scene logged without a reminder" and "a new chat resumes from open_campaign alone",
// are played by hand.)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RulesEngine, SqliteStorage } from "@continuity/core";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server";

const PROMPTS = fileURLToPath(new URL("../../../prompts/", import.meta.url));
const MODULES = ["00-protocol.md", "10-worldbuilding.md", "20-intake.md", "30-play.md"];

const tools = new Set<string>();
const args = new Set<string>();

function collectArgs(schema: unknown) {
  if (!schema || typeof schema !== "object") return;
  const s = schema as Record<string, unknown>;
  if (s.properties && typeof s.properties === "object") {
    for (const [k, v] of Object.entries(s.properties)) {
      args.add(k);
      collectArgs(v);
    }
  }
  if (Array.isArray(s.enum)) for (const v of s.enum) if (typeof v === "string") args.add(v);
  if (s.items) collectArgs(s.items);
  for (const key of ["anyOf", "oneOf", "allOf"]) if (Array.isArray(s[key])) (s[key] as unknown[]).forEach(collectArgs);
}

beforeAll(async () => {
  const server = createServer(new RulesEngine(SqliteStorage.open(":memory:")));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "m4-test", version: "0" });
  await client.connect(b);
  for (const t of (await client.listTools()).tools) {
    tools.add(t.name);
    collectArgs(t.inputSchema);
  }
});

/** Code spans that look like a tool, argument or enum value name (snake_case). */
function names(text: string): string[] {
  return [...text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]!);
}

describe("prompt modules", () => {
  for (const file of MODULES) {
    const path = PROMPTS + file;
    it.skipIf(!existsSync(path))(`${file} names only real tools and arguments`, () => {
      const unknown = names(readFileSync(path, "utf8")).filter((n) => !tools.has(n) && !args.has(n));
      expect(unknown).toEqual([]);
    });
  }

  it("00-protocol.md covers the play loop", () => {
    const text = readFileSync(PROMPTS + "00-protocol.md", "utf8");
    for (const t of ["open_campaign", "get_context", "read_entity", "log_scene", "record_ruling", "close_chapter"]) expect(names(text)).toContain(t);
  });
});
