// Subagent run: turns the GM subagents' saved narration (raw/<arm>-NN/turn-K.md) and the wiki daemon's tool log into
// the same <arm>-NN.json / .md files eval/run.mjs writes, then writes blind judge prompts (judge/jNN.md, shuffled,
// with the key in judge-key.json, outside the judge folder, so the judges never see which arm a transcript came from).
//
//   node eval/agent/assemble.mjs eval/runs/<stamp> [--model ...] [--effort ...]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScenes, saveBlock, sceneCounts, transcriptMd, wikiOpening } from "../run.mjs";
import { JUDGE_SYSTEM, VERDICT_SCHEMA, judgePrompt, loadFacts } from "../score.mjs";

const [runDir, ...rest] = process.argv.slice(2);
const opt = (k, d) => (rest.includes(`--${k}`) ? rest[rest.indexOf(`--${k}`) + 1] : d);
const model = opt("model", "claude-opus-5-5 (Claude Code subagent)");
const effort = opt("effort", "subagent default");
const facts = loadFacts();
const runs = [];
for (const scene of loadScenes()) {
  for (const arm of ["wiki", "plain"]) {
    const dir = join(runDir, "raw", `${arm}-${scene.id}`);
    if (!existsSync(dir)) continue;
    const players = arm === "wiki" ? [wikiOpening(JSON.parse(readFileSync(join(dir, "campaign.json"), "utf8")).campaignId), ...scene.turns] : [saveBlock(), ...scene.turns];
    const log = arm === "wiki" && existsSync(join(dir, "tools.jsonl")) ? readFileSync(join(dir, "tools.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    let prev = 0;
    const turns = players.map((player, i) => {
      const f = join(dir, `turn-${i}.md`);
      const has = existsSync(f);
      const until = has && i < players.length - 1 ? statSync(f).mtimeMs : Infinity; // calls after the last reply still belong to the last turn
      const toolCalls = log.filter((c) => c.at > prev && c.at <= until).map(({ at, ...c }) => c);
      prev = until;
      return { player, narration: has ? readFileSync(f, "utf8").trim() : "_(missing)_", ...(arm === "wiki" ? { toolCalls } : {}) };
    });
    const run = { arm, scene: scene.id, title: scene.title, tests: scene.tests, model, effort, method: "subagent", turns, counts: arm === "wiki" ? sceneCounts(turns) : null, usage: [], fallbacks: [], refusals: 0 };
    writeFileSync(join(runDir, `${arm}-${scene.id}.json`), JSON.stringify(run, null, 2));
    writeFileSync(join(runDir, `${arm}-${scene.id}.md`), transcriptMd(run));
    runs.push({ run, scene });
  }
}
// Blind judge files, in a seeded shuffle so a rerun of assemble gives the same key.
const jdir = join(runDir, "judge");
mkdirSync(jdir, { recursive: true });
let s = 7;
const order = runs.map((r, i) => ({ r, k: (s = (s * 48271) % 2147483647) })).sort((a, b) => a.k - b.k).map((x) => x.r);
const key = {};
order.forEach(({ run, scene }, i) => {
  const id = `j${String(i + 1).padStart(2, "0")}`;
  key[id] = { arm: run.arm, scene: run.scene };
  writeFileSync(join(jdir, `${id}.md`), `${JUDGE_SYSTEM}\n\nAnswer with JSON matching this schema:\n${JSON.stringify(VERDICT_SCHEMA)}\n\n${judgePrompt(run, scene, facts)}\n`);
});
writeFileSync(join(runDir, "judge-key.json"), JSON.stringify(key, null, 2));
console.log(`${runs.length} scenes assembled, ${order.length} judge prompts in ${jdir}`);
