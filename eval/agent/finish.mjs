// Subagent run: reads the judge subagents' verdicts (judge/jNN.verdicts.json), maps them back through judge-key.json,
// writes scores.json and eval/RESULTS.md with the method note.
//
//   node eval/agent/finish.mjs eval/runs/<stamp>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "../lib/mcp.mjs";
import { loadFacts, resultsMd } from "../score.mjs";

const runDir = process.argv[2];
const key = JSON.parse(readFileSync(join(runDir, "judge-key.json"), "utf8"));
const scores = [];
for (const [id, { arm, scene }] of Object.entries(key)) {
  const v = JSON.parse(readFileSync(join(runDir, "judge", `${id}.verdicts.json`), "utf8"));
  for (const x of v.verdicts ?? v) scores.push({ arm, scene, ...x });
}
const runs = readdirSync(runDir).filter((f) => /^(wiki|plain)-\d\d\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(runDir, f), "utf8")));
let method = "";
try {
  method = readFileSync(join(runDir, "METHOD.md"), "utf8").trim();
} catch {}
writeFileSync(join(runDir, "scores.json"), JSON.stringify(scores, null, 2));
let review = "";
try {
  review = "\n" + readFileSync(join(runDir, "REVIEW.md"), "utf8").trim() + "\n";
} catch {}
writeFileSync(join(repo, "eval/RESULTS.md"), resultsMd({ runDir, runs, scores, facts: loadFacts(), method: method || null }) + review);
console.log(join(repo, "eval/RESULTS.md"));
