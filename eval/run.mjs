// Runs the continuity test (SPEC "Evaluation") against the Claude API.
//
//   node eval/run.mjs [--arm wiki|plain|both] [--scenes 01,04] [--model claude-opus-5-5] [--effort high] [--out eval/runs/<stamp>]
//
// Needs EVAL_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY) in the environment and a built MCP server (pnpm --filter @continuity/mcp build).
//
// Each scene starts fresh from the same chapter-1 state, so the ten scenes are independent tests of the twenty facts:
//   wiki arm:  a new database seeded by seed.mjs, the four prompt modules as the system prompt, every MCP tool.
//   plain arm: Parker's original GM prompt as the system prompt, the save block pasted as the first message, no tools.
// Both arms then get the same player turns, word for word, ending with "(OOC) Let's end the scene here."
import { makeClient } from "./lib/client.mjs";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectMcp, repo } from "./lib/mcp.mjs";
import { seed } from "./seed.mjs";

const evalDir = join(repo, "eval");

export function parseArgs(argv) {
  const o = { arm: "both", scenes: null, model: "claude-opus-5-5", effort: "high", out: null, maxToolRounds: 40 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, "");
    const v = argv[++i];
    if (k === "scenes") o.scenes = v.split(",").map((s) => s.trim().padStart(2, "0"));
    else if (k === "max-tool-rounds") o.maxToolRounds = Number(v);
    else if (k in o) o[k] = v;
    else throw new Error(`Unknown option --${k}`);
  }
  if (!["wiki", "plain", "both"].includes(o.arm)) throw new Error("--arm is wiki, plain or both");
  o.out ??= join(evalDir, "runs", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
  return o;
}

/** Reads eval/scenes/*.md: id, title, tested facts and the numbered player turns. */
export function loadScenes(filter) {
  const dir = join(evalDir, "scenes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const id = file.slice(0, 2);
      const title = text.match(/^# (.+)$/m)[1];
      const tests = [...(text.match(/^Tests: (.+)$/m)?.[1] ?? "").matchAll(/F\d\d/g)].map((m) => m[0]);
      const turnsBlock = text.split(/^## Player turns\s*$/m)[1].split(/^## /m)[0];
      const turns = [...turnsBlock.matchAll(/^\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());
      const scoring = text.split(/^## What to score\s*$/m)[1]?.trim() ?? "";
      return { id, file, title, tests, turns, scoring };
    })
    .filter((s) => !filter || filter.includes(s.id));
}

const read = (p) => readFileSync(join(repo, p), "utf8");
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->\s*/g, "");

export const wikiSystem = () =>
  ["00-protocol.md", "10-worldbuilding.md", "20-intake.md", "30-play.md"].map((f) => read(`prompts/${f}`)).join("\n\n---\n\n");
export const plainSystem = () => stripComments(read("eval/baseline/gm-prompt.md")).trim();
export const saveBlock = () => stripComments(read("eval/baseline/save-block.md")).trim();

export const wikiOpening = (campaignId) =>
  `Let's continue our campaign "Run 1" in The Free Cities (campaign_id ${campaignId}). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.`;

/** One request: beta Messages with server-side fallbacks, adaptive thinking, automatic prompt caching, streamed. */
async function ask(client, o, req) {
  const stream = client.beta.messages.stream({
    model: o.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: o.effort },
    cache_control: { type: "ephemeral" },
    ...req,
  });
  return stream.finalMessage();
}

const textOf = (content) =>
  content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();

/** Plays one player turn: sends it, runs any tool calls through MCP, returns the GM's narration. */
async function playTurn(client, o, ctx, userText) {
  ctx.messages.push({ role: "user", content: userText });
  const toolCalls = [];
  const narration = [];
  for (let round = 0; ; round++) {
    if (round >= o.maxToolRounds) throw new Error(`More than ${o.maxToolRounds} tool rounds in one turn`);
    const r = await ask(client, o, { system: ctx.system, messages: ctx.messages, ...(ctx.tools ? { tools: ctx.tools } : {}) });
    ctx.usage.push(r.usage);
    if (r.content.some((b) => b.type === "fallback")) ctx.fallbacks.push(r.model);
    ctx.messages.push({ role: "assistant", content: r.content });
    if (r.stop_reason === "refusal") {
      narration.push("[REFUSAL: the model declined this turn]");
      ctx.refusals++;
      break;
    }
    const t = textOf(r.content);
    if (t) narration.push(t);
    if (r.stop_reason === "pause_turn") continue;
    const uses = r.content.filter((b) => b.type === "tool_use");
    if (r.stop_reason === "max_tokens" && uses.length) throw new Error("Turn hit max_tokens mid tool call");
    if (r.stop_reason !== "tool_use" || !uses.length) break;
    const results = [];
    for (const u of uses) {
      const res = await ctx.mcp.call(u.name, u.input);
      toolCalls.push({ name: u.name, input: u.input, isError: res.isError, status: res.status, text: res.text });
      results.push({ type: "tool_result", tool_use_id: u.id, content: res.text, ...(res.isError ? { is_error: true } : {}) });
    }
    ctx.messages.push({ role: "user", content: results });
  }
  return { narration: narration.join("\n\n"), toolCalls };
}

const WRITE_TOOLS = new Set(["log_scene", "edit_entity", "create_entity", "record_ruling", "update_campaign", "gm_write", "close_chapter", "set_voice_anchor"]);

/** Counts for the RESULTS table: was the scene logged, and how many writes were refused. */
export function sceneCounts(turns) {
  const calls = turns.flatMap((t) => t.toolCalls ?? []);
  const logs = calls.filter((c) => c.name === "log_scene");
  const logged = logs.some((c) => !c.isError);
  let refusedUpdates = 0;
  for (const c of calls) {
    if (!WRITE_TOOLS.has(c.name)) continue;
    if (c.isError) refusedUpdates++;
    else if (c.name === "log_scene") refusedUpdates += (c.status.updates ?? []).filter((u) => u.status === "refused").length;
  }
  return { toolCalls: calls.length, logSceneCalls: logs.length, logged, refusedUpdates, refusedCalls: calls.filter((c) => c.isError).map((c) => ({ name: c.name, rule: c.status.rule ?? null })) };
}

async function runScene(client, o, arm, scene) {
  const ctx = { system: null, messages: [], tools: null, mcp: null, usage: [], fallbacks: [], refusals: 0 };
  const turns = [];
  try {
    if (arm === "wiki") {
      const dir = mkdtempSync(join(tmpdir(), "continuity-eval-"));
      const db = join(dir, "continuity.db");
      const { campaignId } = await seed(db);
      ctx.mcp = await connectMcp(db);
      const { tools } = await ctx.mcp.client.listTools();
      ctx.tools = tools.map((t) => ({ name: t.name, description: t.description ?? "", input_schema: t.inputSchema }));
      ctx.system = wikiSystem();
      turns.push({ player: wikiOpening(campaignId), ...(await playTurn(client, o, ctx, wikiOpening(campaignId))) });
    } else {
      ctx.system = plainSystem();
      turns.push({ player: saveBlock(), ...(await playTurn(client, o, ctx, saveBlock())) });
    }
    for (const t of scene.turns) turns.push({ player: t, ...(await playTurn(client, o, ctx, t)) });
  } finally {
    await ctx.mcp?.close();
  }
  return { arm, scene: scene.id, title: scene.title, tests: scene.tests, model: o.model, effort: o.effort, turns, counts: arm === "wiki" ? sceneCounts(turns) : null, usage: ctx.usage, fallbacks: ctx.fallbacks, refusals: ctx.refusals, messages: ctx.messages };
}

export function transcriptMd(run) {
  const lines = [`# ${run.title} (${run.arm} arm)`, "", `Tests: ${run.tests.join(", ")}. Model ${run.model}, effort ${run.effort}.`, ""];
  run.turns.forEach((t, i) => {
    const player = i === 0 ? (run.arm === "plain" ? "[save block pasted]" : t.player) : t.player;
    lines.push(`## Turn ${i}`, "", `**Player:** ${player}`, "");
    for (const c of t.toolCalls ?? []) lines.push(`> tool \`${c.name}\`${c.isError ? " **REFUSED**" : ""}: ${JSON.stringify(c.input).slice(0, 400)}`);
    if (t.toolCalls?.length) lines.push("");
    lines.push(`**GM:**`, "", t.narration || "_(no narration)_", "");
  });
  if (run.counts) lines.push("## Counts", "", "```json", JSON.stringify(run.counts, null, 2), "```", "");
  return lines.join("\n");
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const client = makeClient();
  const scenes = loadScenes(o.scenes);
  const arms = o.arm === "both" ? ["wiki", "plain"] : [o.arm];
  mkdirSync(o.out, { recursive: true });
  for (const arm of arms) {
    for (const scene of scenes) {
      process.stderr.write(`${arm} ${scene.id} ${scene.title} ... `);
      const run = await runScene(client, o, arm, scene);
      const base = join(o.out, `${arm}-${scene.id}`);
      writeFileSync(`${base}.json`, JSON.stringify(run, null, 2));
      writeFileSync(`${base}.md`, transcriptMd(run));
      process.stderr.write(`done${run.counts ? ` (logged: ${run.counts.logged}, refused: ${run.counts.refusedUpdates})` : ""}\n`);
    }
  }
  console.log(o.out);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
