// The GM subagent's way to call the Continuity Engine MCP tools in the wiki arm.
//
//   node eval/agent/tool.mjs <port> list                    (every tool: name, description, input schema)
//   node eval/agent/tool.mjs <port> <tool> '<json input>'   (or pass the JSON on stdin)
// Prints the tool's result. A refused call prints "ERROR (refused by the server):" first.
import { readFileSync } from "node:fs";

const [port, name, arg] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;
if (name === "list") {
  const tools = await (await fetch(`${base}/tools`)).json();
  for (const t of tools) console.log(`## ${t.name}\n${t.description}\n\ninput schema: ${JSON.stringify(t.input_schema)}\n`);
} else {
  const raw = arg ?? readFileSync(0, "utf8");
  let input;
  try {
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch (e) {
    console.log(`ERROR: input is not valid JSON (${e.message})`);
    process.exit(1);
  }
  const r = await (await fetch(base, { method: "POST", body: JSON.stringify({ name, input }) })).json();
  console.log(r.isError ? `ERROR (refused by the server):\n${r.text}` : r.text);
}
