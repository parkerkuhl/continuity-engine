// Scores a run of eval/run.mjs and writes eval/RESULTS.md.
//
//   node eval/score.mjs eval/runs/<stamp> [--model claude-opus-5-5]
//
// A judge model reads each scene's narration (never the tool calls, so the wiki arm gets no credit for what it read
// but didn't use) and scores every fact the scene tests as honored, violated or not_tested, with a short quote.
// Its verdicts land in <run>/scores.json; review them against the transcripts before trusting RESULTS.md.
import { makeClient } from "./lib/client.mjs";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./lib/mcp.mjs";
import { loadScenes } from "./run.mjs";

/** The fact table rows of eval/facts.md, by id. */
export function loadFacts() {
  const facts = {};
  for (const m of readFileSync(join(repo, "eval/facts.md"), "utf8").matchAll(/^\| (F\d\d) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)) {
    facts[m[1]] = { id: m[1], kind: m[2].trim(), fact: m[3].trim().replace(/\*\*/g, ""), knows: m[4].trim(), testedIn: m[5].trim() };
  }
  return facts;
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          verdict: { type: "string", enum: ["honored", "violated", "not_tested"] },
          quote: { type: "string" },
          reason: { type: "string" },
        },
        required: ["fact", "verdict", "quote", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
};

const JUDGE_SYSTEM = `You score a continuity test for an AI game master. You get the established facts of a campaign, the scoring notes for one scene, and that scene's transcript (player turns and GM narration). For each fact listed, decide:
- honored: the narration and every NPC stay consistent with the fact, including who knows it.
- violated: the narration contradicts it (a healed wound, a dead person acting, a lost item in hand, a secret acted on or revealed by someone who doesn't know it, the player character told something they don't know).
- not_tested: the scene never touched the fact.
Judge only what is on the page. A GM correcting an impossible player move inside the fiction (for example noting the dagger is gone) is honoring the fact. Quote the decisive line (empty if not_tested) and give a one-sentence reason.`;

function judgePrompt(run, scene, facts) {
  const factLines = run.tests.map((id) => `- ${id} (${facts[id].kind}): ${facts[id].fact} Knows: ${facts[id].knows}.`).join("\n");
  const transcript = run.turns
    .map((t, i) => (i === 0 ? `GM (opening):\n${t.narration}` : `PLAYER: ${t.player}\n\nGM:\n${t.narration}`))
    .join("\n\n---\n\n");
  return `# Facts to score\n${factLines}\n\n# Scoring notes for this scene\n${scene.scoring}\n\n# Transcript\n${transcript}`;
}

async function judge(client, model, run, scene, facts) {
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: judgePrompt(run, scene, facts) }],
  });
  const r = await stream.finalMessage();
  if (r.stop_reason === "refusal") throw new Error(`Judge refused ${run.arm}-${run.scene}`);
  const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text).verdicts;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");

/** Builds RESULTS.md from the runs and verdicts. Pure, so it is testable without the API. */
export function resultsMd({ runDir, runs, scores, facts }) {
  const arms = [...new Set(runs.map((r) => r.arm))];
  const tally = (arm) => {
    const v = scores.filter((s) => s.arm === arm);
    return { honored: v.filter((s) => s.verdict === "honored").length, violated: v.filter((s) => s.verdict === "violated").length, not_tested: v.filter((s) => s.verdict === "not_tested").length };
  };
  const model = runs[0]?.model ?? "?";
  const lines = [
    "# Evaluation results",
    "",
    `The continuity test from SPEC "Evaluation": 20 facts (\`eval/facts.md\`), 10 tempting scenes (\`eval/scenes/\`), run with the wiki (\`prompts/\` + MCP server) and without it (the original GM prompt with the save block pasted in). Run \`${runDir.replace(repo + "/", "")}\`, GM model \`${model}\`. Each scene starts fresh from the same chapter-1 state.`,
    "",
    "## Summary",
    "",
    `| Arm | Honored | Violated | Not tested | Honored, of tested | Scenes not logged | Refused updates |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
  ];
  for (const arm of arms) {
    const t = tally(arm);
    const ar = runs.filter((r) => r.arm === arm);
    const unlogged = arm === "wiki" ? String(ar.filter((r) => !r.counts?.logged).length) : "n/a";
    const refused = arm === "wiki" ? String(ar.reduce((n, r) => n + (r.counts?.refusedUpdates ?? 0), 0)) : "n/a";
    lines.push(`| ${arm} | ${t.honored} | ${t.violated} | ${t.not_tested} | ${pct(t.honored, t.honored + t.violated)} | ${unlogged} | ${refused} |`);
  }
  lines.push("", "## Per fact", "", `| Fact | Scene | ${arms.join(" | ")} |`, `| --- | --- | ${arms.map(() => "---").join(" | ")} |`);
  const keys = [...new Set(scores.map((s) => `${s.fact}|${s.scene}`))].sort();
  for (const k of keys) {
    const [fact, scene] = k.split("|");
    const cells = arms.map((arm) => scores.find((s) => s.arm === arm && s.fact === fact && s.scene === scene)?.verdict ?? "-");
    lines.push(`| ${fact} ${facts[fact]?.kind ?? ""} | S${scene} | ${cells.join(" | ")} |`);
  }
  const violations = scores.filter((s) => s.verdict === "violated");
  lines.push("", "## Violations", "");
  if (!violations.length) lines.push("None.");
  for (const v of violations) lines.push(`- **${v.arm}, S${v.scene}, ${v.fact}:** ${v.reason}${v.quote ? ` "${v.quote}"` : ""}`);
  const wiki = runs.filter((r) => r.arm === "wiki");
  if (wiki.length) {
    lines.push("", "## Wiki arm bookkeeping", "", "| Scene | Tool calls | log_scene calls | Logged | Refused updates | Refused calls |", "| --- | --- | --- | --- | --- | --- |");
    for (const r of wiki) {
      const c = r.counts;
      lines.push(`| S${r.scene} | ${c.toolCalls} | ${c.logSceneCalls} | ${c.logged ? "yes" : "**no**"} | ${c.refusedUpdates} | ${c.refusedCalls.map((x) => `${x.name} (${x.rule})`).join(", ") || "none"} |`);
    }
  }
  const refusals = runs.filter((r) => r.refusals);
  const fellBack = runs.filter((r) => r.fallbacks?.length);
  lines.push("", "## Notes", "", `- Model refusals: ${refusals.length ? refusals.map((r) => `${r.arm}-${r.scene}`).join(", ") : "none"}. Turns served by a fallback model: ${fellBack.length ? fellBack.map((r) => `${r.arm}-${r.scene}`).join(", ") : "none"}.`, "- Verdicts come from an LLM judge (`eval/score.mjs`) and were then checked by hand against the transcripts in the run folder.", "");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const runDir = args[0];
  if (!runDir || !existsSync(runDir)) throw new Error("Usage: node eval/score.mjs eval/runs/<stamp> [--model claude-opus-5-5]");
  const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : "claude-opus-5-5";
  const facts = loadFacts();
  const scenes = Object.fromEntries(loadScenes().map((s) => [s.id, s]));
  const runs = readdirSync(runDir)
    .filter((f) => /^(wiki|plain)-\d\d\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(runDir, f), "utf8")));
  const client = makeClient();
  const scores = [];
  for (const run of runs) {
    process.stderr.write(`judging ${run.arm}-${run.scene} ... `);
    for (const v of await judge(client, model, run, scenes[run.scene], facts)) scores.push({ arm: run.arm, scene: run.scene, ...v });
    process.stderr.write("done\n");
  }
  writeFileSync(join(runDir, "scores.json"), JSON.stringify(scores, null, 2));
  writeFileSync(join(repo, "eval/RESULTS.md"), resultsMd({ runDir, runs, scores, facts }));
  console.log(join(repo, "eval/RESULTS.md"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
