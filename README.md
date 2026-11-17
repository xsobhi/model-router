# model-router

A small plugin for Claude Code and Codex that sends each sub-agent task to the cheapest model, and the lowest reasoning effort, that can do it well.

Usage limits get used up fast when every helper runs on your strongest model. Searching a repo or summarising a log does not need it. This plugin tells the main agent, at the start of every session and every sub-agent, which model and effort to pick for which kind of task. The main session keeps whatever model and effort you chose.

In a benchmark where the main agent delegates a lot, it cut the cost of the same task by about half (see [Benchmark](#benchmark)). When the main agent does not delegate, there is nothing for it to save.

It is a plain-text policy plus two small agents. There is no proxy, no server and no dependency except `node` on PATH.

## Install

`node` must be on PATH: the two hooks are one-line node commands that read a markdown file.

**Claude Code**

```
/plugin marketplace add xsobhi/model-router
/plugin install model-router@model-router
```

Or from a terminal:

```
claude plugin marketplace add xsobhi/model-router
claude plugin install model-router@model-router
```

**Codex**

```
codex plugin marketplace add xsobhi/model-router
codex plugin add model-router@model-router
```

Then run `codex`, open `/hooks`, review and trust the plugin's two hooks, and start a new thread. Codex skips plugin hooks until you trust them.

Type `/model-router` (Claude Code) or `$model-router:model-router` (Codex) to see the active policy.

## How it routes

| Task | Claude Code | Codex |
|---|---|---|
| Searching, reading, summarising files, logs and pages; simple lookups; mechanical checks | `haiku`, effort `low` (agent `model-router:scout`, read-only) | smallest, fastest model, low effort |
| Routine, well-specified work: code changes with a clear plan, tests, refactors, docs, builds | `sonnet`, effort `medium` (agent `model-router:builder`) | the everyday workhorse, medium effort |
| Hard or risky work: stubborn bugs, architecture and planning, security, irreversible actions | `opus`, effort `high` (`xhigh` or `max` only for the very hardest problems) | most capable model, high effort |

If unsure, the cheaper model goes first and the work escalates when it struggles. Sub-agents are told to pass the rule on to any agents they start.

How it works:

- `SessionStart` injects `policy.md` (Claude Code) or `policy-codex.md` (Codex) as additional context.
- `SubagentStart` injects the same text into each sub-agent.
- `agents/scout.md` (haiku, `effort: low`, tools limited to Read, Grep, Glob, WebFetch, WebSearch) and `agents/builder.md` (sonnet, `effort: medium`) are ready-made helpers for the first two tiers. Claude Code only.
- `skills/model-router/SKILL.md` is the `/model-router` command.

### Effort on Claude Code

Two things set the effort of a sub-agent:

- The `effort:` line in an agent's frontmatter. Claude Code reads it (`low`, `medium`, `high`, `xhigh` or `max`, depending on the model), but I could not find it in the docs, so treat it as undocumented and check it still works after an update. Verified on Claude Code 2.1.326: a scout with `effort: low` sent `output_config: {"effort": "low"}` to the API, and a builder whose copy I temporarily changed to `effort: high` sent `high`.
- The Agent tool's `effort` parameter, set per call. Claude Code only sets it when instructions ask for it, so `policy.md` says that installing the plugin is that instruction. In the benchmark below every sub-agent in the plugin arm ran with exactly the model and effort the main agent asked for.

### Conflicts to avoid

- `CLAUDE_CODE_SUBAGENT_MODEL` is an environment variable that sets the model of sub-agents. It is meant to override per-agent models, so it can fight this plugin's routing. In my test on 2.1.326 it only applied to sub-agents that had no model of their own (an explicit `model` on the Agent call and an agent's frontmatter model both won over it), but I would not rely on that staying so. Leave it unset while you use this plugin.
- A rule in your own `CLAUDE.md` that also picks sub-agent models. Two rules for the same thing cost tokens and can disagree. Keep one.

### Codex: what it can and cannot do

Codex's plugin docs do not list agent roles as something a plugin can bundle, so the Codex side is instruction-only (no scout/builder agents). What exists, checked against codex-cli 0.162.1:

- Each `spawn_agent` call can carry its own `model` and `reasoning_effort`. The policy tells Codex to set them by tier, and to use only models and efforts that Codex lists as supported. It does not hard-code model names: the tiers are "smallest", "everyday" and "most capable", resolved against the catalog you actually have (`codex debug models` prints it).
- Codex's own `spawn_agent` text says not to set `model` unless the user asks, and it only spawns sub-agents when you or your project instructions ask for delegation. The policy states that you asked for tiered models by installing the plugin. Whether the model follows it is up to the model. In the one Codex pair I ran (see [Benchmark](#benchmark)), it set the smallest model and low effort on 2 of 5 sub-agents and left the other 3 on the default.
- This plugin never asks Codex to delegate more. It only affects which model a delegated task gets.
- For a setting that does not depend on the model following instructions, use Codex config. In `~/.codex/config.toml` (verified to parse in 0.162.1):

  ```toml
  [agents]
  default_subagent_model = "<an id from `codex debug models`>"
  default_subagent_reasoning_effort = "medium"

  [agents.scout]
  description = "Read-only searcher for finding code and reading files."
  config_file = "agents/scout.toml"   # sets model, model_reasoning_effort, developer_instructions
  ```

  A spawn request that sets a model still wins over these defaults. Codex documents standalone role files under `~/.codex/agents/` and `.codex/agents/` too; I only checked the `config.toml` form above.

## Customise

Fork the repo and edit `policy.md` (Claude Code) or `policy-codex.md` (Codex). Both are about 270 tokens (1,069 and 1,096 bytes); keep them short, because they are paid for on every session and every sub-agent.

- Change which model a tier uses, or add a tier, by editing the bullets.
- Codex: the "tier map" line at the bottom of `policy-codex.md` can pin exact model ids instead of `auto`.
- The agents' models and efforts are the `model:` and `effort:` lines in `agents/*.md`.

Then install your fork: `/plugin marketplace add <you>/model-router`.

## Uninstall

```
/plugin uninstall model-router@model-router
```

or `claude plugin uninstall model-router@model-router`, then `claude plugin marketplace remove model-router`. On Codex: `codex plugin remove model-router@model-router`, then `codex plugin marketplace remove model-router`.

## Token cost

Measured on Claude Code 2.1.326 with `claude plugin details model-router` in a throwaway config dir:

- Always on: about 190 tokens (the skill and the two agent descriptions). Version 1.0.0 measured about 135; the tool's estimate rose after this release's changes (the `effort` lines and the longer `policy.md`); I did not break it down further.
- `claude plugin details` marks the hooks as "harness-only, no model context cost". That is true for running them, but what they print does enter the context: `policy.md` is 1,069 bytes, roughly 270 tokens, once per session and once per sub-agent started. `policy-codex.md` is 1,096 bytes, roughly 275 tokens. Those two figures are my estimate from byte counts, not a tokenizer measurement.

So the plugin costs a few hundred tokens up front and about 270 more per sub-agent. It pays for itself only if the routing moves real work to cheaper models.

## Benchmark

Small and honest: 12 Claude Code runs, 3 per arm and scenario, plus one Codex pair. Numbers are from 2026-11-17 on Claude Code 2.1.326. Everything needed to repeat it is in `bench/`.

### Setup

- Arm A has no plugin. Arm B has this plugin (1.1.0 contents), installed from the local path with `claude plugin marketplace add` and `claude plugin install`. Both use `--model opus` at default effort (medium in 2.1.326).
- Every run gets its own throwaway `CLAUDE_CONFIG_DIR` and `HOME`, and an environment with no `CLAUDE_*` variables (so no `CLAUDE_CODE_SUBAGENT_MODEL`). Only the OAuth credentials file is copied in, with mode 600, and the directory is deleted afterwards. Neither arm sees my real `~/.claude`, its `CLAUDE.md` (which already has a routing rule), other plugins or skills. Runs alternate A, B, A, B so cache and time of day hit both arms alike.
- Command per run: `claude -p <prompt> --model opus --max-turns 40 --max-budget-usd 5 --permission-mode bypassPermissions --output-format stream-json --verbose`, in a fresh copy of the fixture.
- Fixture (`bench/fixture`, "shopcalc"): a small Node package with 12 source files (about 200 lines), 8 test files and 45 tests, no dependencies. 13 tests fail at the start because of two seeded one-line bugs (a cart that replaces a line's quantity instead of adding to it; a tax-exemption check that uses `in` on an array) plus one small feature (`topSkus` in `src/report.js`, specified in `docs/FEATURE.md`, tests already written).
- Pass means: after the run, I replace `test/` with the original tests and `npm test` passes all 45. Nothing edited a test in any run.
- Cost is `total_cost_usd` from Claude Code, a list-price equivalent. Tokens are input + output + cache read + cache write.

Two prompts, same for both arms.

**natural**: the delegation is the main agent's call.

> The test suite of this project (npm test) has several failing tests spread over different modules: cart, tax, orders, inventory and report. Please do three things.
>
> 1. Investigate why the tests fail. There is a fair amount to look through, so use sub-agents for the investigation as you see fit (for example one per failing module, in parallel) and have them report back.
> 2. Fix the underlying bugs in src/. Do not edit the tests.
> 3. Implement the feature described in docs/FEATURE.md (its tests are already in test/report.test.js).
>
> Finish with npm test passing and a three-line summary of what was wrong and what you changed.

**delegate**: the prompt asks for a delegation-heavy workflow, so there is something to route.

> The test suite of this project (npm test) has several failing tests spread over different modules: cart, tax, orders, inventory and report. Please work like this.
>
> 1. Start one sub-agent per failing module, in parallel, to find the root cause and report back. They investigate only; they do not edit files.
> 2. Then have sub-agents make the fixes in src/ (do not edit the tests) and implement the feature described in docs/FEATURE.md (its tests are already in test/report.test.js).
> 3. You review their work and run npm test until it passes.
>
> Finish with a three-line summary of what was wrong and what changed.

### Results: delegate (3 runs per arm, mean and min to max)

| | A: no plugin | B: model-router | Change |
|---|---|---|---|
| Runs passed | 3/3 | 3/3 | |
| Cost, USD | 1.22 (1.19 to 1.25) | 0.56 (0.50 to 0.60) | **-54%** |
| of which opus | 1.22 | 0.45 (0.41 to 0.48) | |
| of which sonnet + haiku | 0.00 | 0.11 (0.09 to 0.13) | |
| Wall time, s | 78 (74 to 81) | 64 (58 to 68) | -17% |
| Sub-agents started | 7 (7 to 7) | 7 (7 to 7) | |
| Main agent API calls | 13 (13 to 13) | 12 (11 to 13) | |
| Main agent tokens, k | 442 (440 to 444) | 430 (372 to 479) | -3% |
| Sub-agent tokens on opus, k | 410 (381 to 466) | 0 | |
| Sub-agent tokens on haiku or sonnet, k | 0 | 213 (192 to 244) | |

In arm A all 7 sub-agents (5 Explore, 2 general-purpose) inherited opus at the default effort. In arm B the main agent picked 5 scouts on haiku/low and 2 builders on sonnet/medium, in every run. The opus main agent is still most of the bill; the saving is the sub-agent half moving to cheaper models.

### Results: natural (3 runs per arm)

| | A: no plugin | B: model-router | Change |
|---|---|---|---|
| Runs passed | 3/3 | 3/3 | |
| Cost, USD | 0.24 (0.21 to 0.26) | 0.31 (0.25 to 0.35) | +31% |
| Wall time, s | 19 (17 to 21) | 38 (18 to 48) | +99% |
| Sub-agents started | 0 (0 to 0) | 2.7 (0 to 5) | |
| Main agent API calls | 4 (4 to 4) | 8.3 (4 to 11) | |

This is the finding to take away: **when the prompt only allowed delegation, the baseline never delegated** (0 of 3). The opus main agent read the 200-line source in two commands and said that sub-agents "would cost more than they'd save here". With the plugin it started scouts in 2 of 3 runs and finished more slowly and more expensively, because every sub-agent that finishes wakes the main agent for another call, and on a repo this small that overhead is bigger than the haiku work it saves. In the one plugin run that did not delegate, the cost was $0.25 against $0.21 to $0.26 for the baseline, so the plugin's own context overhead is within noise at this size. With 3 runs I cannot say whether the plugin's text makes the main agent delegate more or whether that was chance.

The plugin saves money on delegated work only. On a task small enough that the main agent does it alone, it saves nothing; if it tips the agent into delegating, it can cost more.

### Every run

| Scenario | Run | Arm | Tests | Cost | Time | Sub-agents (model/effort) |
|---|---|---|---|---|---|---|
| natural | 1 | A | 45/45 | $0.21 | 21 s | none |
| natural | 1 | B | 45/45 | $0.33 | 47 s | 3 x scout haiku/low |
| natural | 2 | A | 45/45 | $0.26 | 17 s | none |
| natural | 2 | B | 45/45 | $0.35 | 48 s | 5 x scout haiku/low |
| natural | 3 | A | 45/45 | $0.23 | 19 s | none |
| natural | 3 | B | 45/45 | $0.25 | 18 s | none |
| delegate | 1 | A | 45/45 | $1.25 | 81 s | 5 Explore + 2 general-purpose, all opus at default effort |
| delegate | 1 | B | 45/45 | $0.60 | 66 s | 5 x scout haiku/low, 2 x builder sonnet/medium |
| delegate | 2 | A | 45/45 | $1.23 | 74 s | same as run 1 |
| delegate | 2 | B | 45/45 | $0.50 | 58 s | same as run 1 |
| delegate | 3 | A | 45/45 | $1.19 | 78 s | same as run 1 |
| delegate | 3 | B | 45/45 | $0.57 | 68 s | same as run 1 |

Raw per-run data (tokens per model, main versus sub-agents, models and efforts that actually ran) is in `bench/results/claude.json`. I checked the models and efforts from each run's own session transcripts and usage report, not just from what the main agent asked for.

### Codex: one pair

One run per arm with `codex exec --json` (codex-cli 0.162.1), each in a throwaway `CODEX_HOME` with only `auth.json` copied in, using the delegate prompt. Both passed 45/45. Codex reports tokens but no dollars, so there is no cost figure.

| | A: no plugin | B: model-router |
|---|---|---|
| Main agent tokens (gpt-6.1-sol) | 445k | 448k |
| Sub-agent tokens on gpt-6.1-sol | 625k (5 threads) | 318k (3 threads) |
| Sub-agent tokens on gpt-6-luna, low effort | 0 | 476k (2 threads) |
| Total tokens | 1,070k | 1,242k |
| Wall time | 93 s | 96 s |

With the plugin, the main agent set `model: gpt-6-luna, reasoning_effort: low` on 2 of its 5 spawn calls and left the other 3 on the default. Total tokens went up 16%, because the smaller model used more of them. Whether that is cheaper depends on prices and subscription accounting I cannot see, so I draw no conclusion from one pair. Two caveats on how it ran: the plugin's hooks were run with `--dangerously-bypass-hook-trust` (a fresh `CODEX_HOME` trusts nothing; passed to both arms), and with `--dangerously-bypass-approvals-and-sandbox` because the Codex sandbox (bwrap) would not start on my VM (my first attempt with it on failed in both arms). Both ran in a throwaway copy of the fixture.

The Codex plugin in that run was the copy installed at version 1.0.0; `policy-codex.md` and the Codex hooks are unchanged in 1.1.0. Data: `bench/results/codex.json`.

### Caveats

- Small n: 3 runs per arm and scenario, one Codex pair. Read the spread as noise-level information, not as a confidence interval.
- One fixture, and a tiny one (about 200 lines of source). On a large repo the sub-agents would read much more, so I expect more saving from routing, but I did not measure that.
- The delegate prompt tells the agent to delegate. A real session may delegate more or less than that.
- Costs are list-price equivalents from `total_cost_usd`. Subscription usage limits are counted differently and the ratios may differ.
- One model family and one Claude Code version. The sub-agent models in arm A were opus because Explore and general-purpose inherit the main model in this setup; with other settings or versions the baseline could already be cheaper.
- Prompt caching can shift individual runs; the alternating order is there to spread it, not to remove it.
- The two bugs are easy to find on purpose, so every run passed. This benchmark measures cost, not whether cheaper models fail on harder bugs.

### What the benchmark cost

The 12 Claude runs cost $6.98 in total: arm A $4.37 (natural $0.71, delegate $3.66) and arm B $2.61 (natural $0.93, delegate $1.68). Manual checks before the benchmark (a few smoke sessions, the frontmatter tests, the `CLAUDE_CODE_SUBAGENT_MODEL` tests) added about $0.75, so about $7.7 all in, well under the $25 limit I set. The Codex pair used about 2.3M tokens and has no dollar figure.

### Run it yourself

```
node bench/run.mjs --scenario natural  --runs 3 --out /tmp/mr-bench
node bench/run.mjs --scenario delegate --runs 3 --out /tmp/mr-bench
node bench/run.mjs --summarize /tmp/mr-bench/results.json
node bench/codex.mjs --scenario delegate        # optional, Codex
```

It needs `claude` (logged in; only `~/.claude/.credentials.json` is copied, set `CLAUDE_CREDENTIALS` to use another file), `node`, and about $7 of API-equivalent usage. `--budget` caps each run (default $5) and `--cap` stops the whole benchmark (default $25). Nothing from your real config is used and the throwaway directories are deleted at the end. The scripts never write credentials anywhere else.

## Honest notes

- The saving is measured on one tiny fixture and 3 runs per arm (see [Benchmark](#benchmark)): about half the cost when the main agent delegates a lot, and no saving, or a loss, when it does not. I will not extrapolate a percentage to your work. It depends on how much of your work goes to sub-agents and how much of that is searching and reading.
- The policy is an instruction, not enforcement. Nothing blocks a call that picks the wrong model. On Claude Code the main agent followed it for all 29 sub-agents it started in the plugin arm; on Codex it followed it on 2 of 5.
- The `effort:` agent frontmatter field is undocumented (see [Effort on Claude Code](#effort-on-claude-code)).
- Tested: `claude plugin validate . --strict` (passes; its only warning is that the plugin has no icon), a local install into a throwaway config dir with `claude plugin details`, the hook commands run by hand (valid hook-output JSON, same text as the policy files), real `claude -p` sessions whose transcripts show the Agent tool calls and the models and efforts that ran, and a Codex local install plus one Codex session. Linux only. The hooks should work on macOS and Windows, since they only use `node` and forward slashes, but I have not run them there.

## Credit

Inspired by the common "use a cheap model for helpers" advice. The plugin layout follows [ponytail](https://github.com/DietrichGebert/ponytail).

## License

MIT, see [LICENSE](LICENSE).
