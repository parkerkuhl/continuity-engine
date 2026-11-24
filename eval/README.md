# Evaluation (Milestone 7)

The continuity test from SPEC "Evaluation". Twenty facts (`facts.md`) and ten tempting scenes (`scenes/`). Each scene runs twice: once with the wiki (the `prompts/` modules plus the MCP server) and once without it (Parker's original GM prompt in `baseline/gm-prompt.md`, with the save block in `baseline/save-block.md` pasted in).

```
pnpm install
pnpm --filter @continuity/mcp build
export EVAL_ANTHROPIC_API_KEY=...       # or ANTHROPIC_API_KEY; set it in the environment, never paste it into a chat
node eval/run.mjs --arm both            # writes eval/runs/<stamp>/{wiki,plain}-NN.{json,md}
node eval/score.mjs eval/runs/<stamp>   # LLM judge, writes scores.json and eval/RESULTS.md
```

Options for `run.mjs`: `--scenes 01,04` (a subset), `--model` (default `claude-opus-5-5`), `--effort` (default `high`).

- Each scene starts fresh from the same chapter-1 state: the wiki arm gets a new database from `seed.mjs`, the plain arm a new chat. The player turns are identical in both arms.
- Requests use adaptive thinking, prompt caching and server-side `fallbacks: "default"`, so a declined turn is retried on Anthropic's fallback model; the run records which scenes that happened in.
- The judge reads only the narration, not tool calls. Check its verdicts against the transcripts before trusting `RESULTS.md`.
- Unlogged scenes and refused updates are counted from the wiki arm's tool calls.
