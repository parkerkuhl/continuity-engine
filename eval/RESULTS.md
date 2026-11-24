# Evaluation results

> **This was a subagent run, not the API runner.** The Claude API account had no credits, so on 2026-11-24 Parker asked for the test to run with Claude Code subagents in one session instead of `eval/run.mjs`. Each of the 20 scenes (10 per arm) had its own fresh GM subagent. The plain arm's GM read only `eval/baseline/gm-prompt.md` and took `eval/baseline/save-block.md` as the player's first message. The wiki arm's GM read only the four `prompts/` modules and called the real MCP server, on a freshly seeded database per scene, through `eval/agent/tool.mjs`. Every call was logged by the server side (`eval/agent/daemon.mjs`), not reported by the GM. Both arms got the same scripted player turns, one message at a time, and saved each reply verbatim. Twenty more fresh subagents judged the transcripts with the same judge prompt `eval/score.mjs` uses. They got shuffled, unlabeled files (`judge/jNN.md`), so no judge knew which arm it was scoring, and no GM scored itself.
>
> What this means: the GMs ran on the session's model inside Claude Code, not on the bare Messages API. That means a Claude Code system prompt sat under the GM prompt, the effort level was the subagent default rather than `high`, and the GM read its prompt from files instead of a system prompt. The rule against reading other files (facts, scenes, scoring notes) was an instruction, not a sandbox. Token usage wasn't recorded per scene. Reruns won't be byte-identical, and an API run (`eval/run.mjs`, unchanged) is still the cleaner measurement once credits are in place.

The continuity test from SPEC "Evaluation": 20 facts (`eval/facts.md`), 10 tempting scenes (`eval/scenes/`), run with the wiki (`prompts/` + MCP server) and without it (the original GM prompt with the save block pasted in). Run `eval/runs/2026-11-24T04-15-56-subagent`, GM model `claude-opus-5-5 (Claude Code subagent)`. Each scene starts fresh from the same chapter-1 state.

## Summary

| Arm | Honored | Violated | Not tested | Honored, of tested | Scenes not logged | Refused updates |
| --- | --- | --- | --- | --- | --- | --- |
| plain | 23 | 0 | 0 | 100% | n/a | n/a |
| wiki | 22 | 1 | 0 | 96% | 0 | 20 |

## Per fact

| Fact | Scene | plain | wiki |
| --- | --- | --- | --- |
| F01 Injury | S01 | honored | honored |
| F01 Injury | S10 | honored | honored |
| F02 Injury | S01 | honored | honored |
| F03 Injury | S07 | honored | honored |
| F04 Death | S04 | honored | honored |
| F05 Death | S04 | honored | honored |
| F06 Debt | S03 | honored | honored |
| F06 Debt | S09 | honored | honored |
| F07 Debt | S10 | honored | honored |
| F08 Secret | S02 | honored | honored |
| F08 Secret | S10 | honored | honored |
| F09 Secret | S07 | honored | honored |
| F10 Secret | S02 | honored | honored |
| F11 Secret | S08 | honored | violated |
| F12 Item | S06 | honored | honored |
| F13 Item | S01 | honored | honored |
| F14 Item | S06 | honored | honored |
| F15 Item | S05 | honored | honored |
| F16 Promise | S03 | honored | honored |
| F17 Promise | S06 | honored | honored |
| F18 Promise | S09 | honored | honored |
| F19 Ruling | S08 | honored | honored |
| F20 Status | S05 | honored | honored |

## Violations

- **wiki, S08, F11:** Hesse is never told, but the narration says it is true that Marro doesn't know why a Maegyr would host Rickard, which contradicts his knowing that Rickard's mother was a Maegyr daughter. ""I don't know," Marro said.

It was true. He was surprised how little that helped."

## Wiki arm bookkeeping

| Scene | Tool calls | log_scene calls | Logged | Refused updates | Refused calls |
| --- | --- | --- | --- | --- | --- |
| S01 | 16 | 3 | yes | 3 | create_entity (not_found) |
| S02 | 9 | 2 | yes | 1 | none |
| S03 | 19 | 4 | yes | 2 | none |
| S04 | 14 | 5 | yes | 3 | none |
| S05 | 20 | 5 | yes | 2 | none |
| S06 | 11 | 2 | yes | 0 | none |
| S07 | 12 | 4 | yes | 2 | none |
| S08 | 27 | 3 | yes | 3 | none |
| S09 | 16 | 4 | yes | 2 | none |
| S10 | 9 | 3 | yes | 2 | none |

## Notes

- Model refusals: none. Turns served by a fallback model: none.
- Verdicts come from fresh judge subagents (see the method note at the top) and were then checked by hand against the transcripts in the run folder (see "Hand review" below).

## Hand review (2026-11-24)

- **The one violation (wiki, S08, F11) stands, but it is borderline.** The player's line was "I tell her I don't know", which is Marro lying to Hesse and is fine. The GM then added "It was true." Marro knows Rickard's mother was a Maegyr daughter, so the narration contradicts what he knows. The GM may have meant that Marro doesn't know why this cousin invited them, but the judge's reading is the plain one, so the verdict is kept as given.
- **The plain arm's high score partly comes from refusing premises.** The plain GM stepped out of character more often, sometimes to tell the player the scene couldn't happen as described. Counting `(OOC)` markers, plain S08 has six, and S03, S04 and S10 have three each. Every wiki transcript has two. In S08 the plain GM ruled that the feast didn't happen at all. That keeps every fact, but it costs the player the scene. The wiki GM usually played the scene and kept the facts inside it. The judge scores facts only, so the table doesn't show this difference.
- **Refused updates are all one pattern.** Of the 20 refused updates, 17 were `read_before_write` and 3 were `invalid_tag` (all in S08). Every `read_before_write` refusal was about an entity the GM hadn't read that session, mostly new or minor ones (Triarch Malaquo, Golden Company, Dagna, Pallo). In every scene the GM then read the entity and logged the update again, and the last `log_scene` call in each scene had no refusals, so nothing was lost. The protocol module could tell the GM to read every entity it means to update before calling `log_scene`.
- **Not fixed (known gap):** `get_context` still shows updates the PC doesn't know outside the `GM ONLY` block.
- **Ambient context:** each GM subagent's transcript names `eval/facts.md`, `eval/scenes/` and `SPEC.md` once. That matches the repo's CLAUDE.md, which every Claude Code subagent loads, and not a file read. The GMs never opened those files, but they could see that they exist.
