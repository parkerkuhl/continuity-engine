// Subagent run, wiki arm: seeds a fresh wiki, keeps the real MCP server open on it, and serves its tools over
// localhost HTTP so a GM subagent can call them with eval/agent/tool.mjs. Every call is appended to a JSONL log,
// which is the record the run uses (not the GM's own account of what it called).
//
//   node eval/agent/daemon.mjs <port> <scene-dir>     (writes <scene-dir>/tools.jsonl and <scene-dir>/campaign.json)
import { createServer } from "node:http";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectMcp } from "../lib/mcp.mjs";
import { seed } from "../seed.mjs";

const [port, dir] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const db = join(mkdtempSync(join(tmpdir(), "continuity-eval-")), "continuity.db");
const { campaignId } = await seed(db);
const mcp = await connectMcp(db);
const { tools } = await mcp.client.listTools();
writeFileSync(join(dir, "campaign.json"), JSON.stringify({ campaignId, db }, null, 2));

const body = (req) => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => ok(s)); });
createServer(async (req, res) => {
  try {
    if (req.url === "/tools") {
      res.end(JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }))));
      return;
    }
    const { name, input } = JSON.parse(await body(req));
    const r = await mcp.call(name, input ?? {});
    appendFileSync(join(dir, "tools.jsonl"), JSON.stringify({ at: Date.now(), name, input, isError: r.isError, status: r.status, text: r.text }) + "\n");
    res.end(JSON.stringify(r));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ text: String(e?.message ?? e), isError: true }));
  }
}).listen(Number(port), "127.0.0.1", () => console.log(`ready ${port} ${campaignId}`));
