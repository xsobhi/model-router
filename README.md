# model-router

A small plugin for Claude Code and Codex that sends each sub-agent task to the cheapest model, and the lowest reasoning effort, that can do it well.

Usage limits get used up fast when every helper runs on your strongest model. Searching a repo or summarising a log does not need it. This plugin tells the main agent, at the start of every session and every sub-agent, which model and effort to pick for which kind of task. The main session keeps whatever model and effort you chose.

In a benchmark where the main agent delegates a lot, it cut the same task's price-weighted token usage by 47% and its list-price cost by 58% (version 1.1.1, 3 runs per arm; see [Benchmark](#benchmark)). The plan's weekly usage meter moves in 1% steps and could not resolve a difference that small. When the main agent does not delegate, there is nothing for it to save, and version 1.1.0 turned out to nudge it into delegating small tasks. 1.1.1 adds a line against that (see the "natural" rows).

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

Fork the repo and edit `policy.md` (Claude Code) or `policy-codex.md` (Codex). `policy.md` is about 300 tokens (1,198 bytes) and `policy-codex.md` about 275 (1,096 bytes); keep them short, because they are paid for on every session and every sub-agent.

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

- Always on: about 165 tokens in 1.1.1 (the skill and the two agent descriptions). That estimate is rough: the same tool gave about 135 for 1.0.0 and about 190 for 1.1.0, with nearly the same component text. Read it as "a couple of hundred tokens".
- `claude plugin details` marks the hooks as "harness-only, no model context cost". That is true for running them, but what they print does enter the context: `policy.md` is 1,198 bytes, roughly 300 tokens, once per session and once per sub-agent started. `policy-codex.md` is 1,096 bytes, roughly 275 tokens. Those two figures are my estimate from byte counts, not a tokenizer measurement.

So the plugin costs a few hundred tokens up front and about 300 more per sub-agent. It pays for itself only if the routing moves real work to cheaper models.

## Benchmark

Small and honest: 12 Claude Code runs, 3 per arm and scenario, plus one Codex pair. Numbers are from 2026-11-17 on Claude Code 2.1.326. Everything needed to repeat it is in `bench/`.

### Setup

- Arm A has no plugin. Arm B has this plugin, installed from the local path with `claude plugin marketplace add` and `claude plugin install`. The delegate runs and the first natural runs used the 1.1.0 text; the natural rerun used 1.1.1 (see below). Both use `--model opus` at default effort (medium in 2.1.326).
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

### Headline: usage-limit consumption (v1.1.1, all four cells re-measured)

Subscription users feel usage limits, not dollars, so this batch of 12 runs (3 per arm and scenario, same fixture, prompts and flags as above, plugin arm on 1.1.1) also reads the plan's usage meter around every run. The earlier 1.1.0 runs were not measured this way.

How plan usage is read (only mechanisms Claude Code itself exposes):

- `claude -p /usage` prints "Current week (all models): N% used". It is a local command: no model call, no tokens. Run in a brand-new config dir it asks the usage endpoint live; in an old dir it can answer from a snapshot minutes old, so every reading uses its own fresh throwaway dir. I read it before each run and 15 s after it.
- The statusline JSON input has `rate_limits` (documented). I checked it through a real interactive session: it holds only `seven_day.used_percentage`. The stream-json output has `rate_limit_event` messages with the same weekly figure, but they lag the live reading by a run or two, so I only record them.
- **This account has no five-hour window.** `/usage`, the statusline and the stream events all report only the weekly limit (all models) and a separate weekly one for Fable. So there is no five-hour figure to report. (`unifiedWindows` in the stream contains only `seven_day`.)
- The meter moves in whole percentage points. Runs were strictly sequential, but other sessions run on the same account (including the one driving this benchmark), so every delta also contains whatever they used meanwhile.
- A guard stops the benchmark if the weekly limit reaches 97% used (it started at 94%).

Because the points are so coarse, the second usage number is a proxy: **weighted tokens**, which count every token of a run (input, output, cache reads, cache writes) times the model's price relative to opus. The weights come from `total_cost_usd` itself: it implies about $0.10, $1.80 and $3.60 per million input tokens for haiku, sonnet and opus, so haiku : sonnet : opus = 1 : 18 : 36, opus = 1. I fitted those from this benchmark's own runs (haiku exact, sonnet within 0.5%, opus within about 6%); I did not look them up in a price list. Cost in dollars is the finer version of the same idea, because it also prices each token type differently.

Delegate scenario (the prompt asks for sub-agents):

| | A: no plugin | B: model-router 1.1.1 | Change |
|---|---|---|---|
| Runs passed | 3/3 | 3/3 | |
| **Weekly limit, points used** (sum of the 3 runs, from `/usage`) | 0 | 0 | not resolvable |
| **Weighted tokens**, k opus-equivalent | 854 (784 to 925) | 456 (428 to 499) | **-47%** |
| Tokens, k, all models, unweighted | 843 | 605 | -28% |
| Cost, USD | 1.24 (1.14 to 1.32) | 0.53 (0.50 to 0.57) | -58% |
| Wall time, s | 71 (67 to 73) | 61 (51 to 69) | -14% |
| Sub-agents | 7.3 (7 to 8), all opus | 7 (7 to 7): 5 haiku/low, 2 sonnet/medium | |

Natural scenario (the prompt only allows delegation):

| | A: no plugin | B: model-router 1.1.1 | Change |
|---|---|---|---|
| Runs passed | 3/3 | 3/3 | |
| **Weekly limit, points used** (sum of the 3 runs) | 0 | +1 | noise |
| **Weighted tokens**, k opus-equivalent | 119 (113 to 125) | 124 (123 to 124) | +4% |
| Tokens, k, unweighted | 117 | 122 | +5% |
| Cost, USD | 0.23 (0.19 to 0.26) | 0.25 (0.24 to 0.25) | +8% |
| Wall time, s | 19.9 (19.1 to 21.2) | 20.1 (19.4 to 20.9) | +1% |
| Sub-agents | 0 | 0 | |

What this says:

- When the main agent delegates, the plugin cuts weighted usage by nearly half. The saving is smaller in tokens (-28%) than in weighted tokens or dollars because the work still has to be read; it is just read by cheaper models. All 22 sub-agents in arm A ran opus at the default effort; all 21 in arm B ran the model and effort they were asked for (haiku/low and sonnet/medium).
- When it does not delegate, which is what 1.1.1 now does on a small task (0 of 3 delegated, and 0 of 3 again in the earlier 1.1.1 rerun), the plugin costs a few percent for its extra context (about 300 tokens of policy plus the agent descriptions). That is small and I would not call it more than that with 3 runs.
- **The weekly meter could not see any of this.** Over the 12 runs it went from 94% to 95%: one point, and the tick happened during a natural run that cost $0.24, so it is not that run's doing. The 12 runs cost $6.71 list-equivalent, so the true change was between 0 and 2 points, which puts one point at more than about $3.40 of list-price cost on this plan. Individual runs ($0.19 to $1.32) fall below that resolution, and the per-run readings are mostly 0 (`bench/results/claude.json` has all of them). Weighted tokens are the usable usage number here; read the weekly column as "no visible change".

Every run of this batch:

| Scenario | Run | Arm | Weekly limit | Weighted tokens | Cost | Time | Sub-agents (model/effort) |
|---|---|---|---|---|---|---|---|
| natural | 1 | A | 94% to 94% | 125k | $0.19 | 21 s | none |
| natural | 1 | B | 94% to 94% | 124k | $0.25 | 19 s | none |
| natural | 2 | A | 94% to 94% | 118k | $0.26 | 19 s | none |
| natural | 2 | B | 94% to 94% | 124k | $0.25 | 21 s | none |
| natural | 3 | A | 94% to 94% | 113k | $0.24 | 19 s | none |
| natural | 3 | B | 94% to 95% | 123k | $0.24 | 20 s | none |
| delegate | 1 | A | 95% to 95% | 854k | $1.25 | 67 s | 5 Explore + 2 general-purpose, opus/default |
| delegate | 1 | B | 95% to 95% | 499k | $0.57 | 69 s* | 5 scout haiku/low, 2 builder sonnet/medium |
| delegate | 2 | A | 95% to 95% | 925k | $1.32 | 73 s | 5 Explore + 3 general-purpose, opus/default |
| delegate | 2 | B | 95% to 95% | 428k | $0.50 | 51 s* | 5 scout haiku/low, 2 builder sonnet/medium |
| delegate | 3 | A | 95% to 95% | 784k | $1.14 | 72 s | 5 Explore + 2 general-purpose, opus/default |
| delegate | 3 | B | 95% to 95% | 440k | $0.51 | 62 s | 5 scout haiku/low, 2 builder sonnet/medium |

\* The `claude -p` process finished its work and then never exited (it printed its result and sat idle; one of them for 14 minutes). I stopped it by hand (B1) and with a watchdog (B2). Cost, tokens and test results come from the finished stream and are unaffected; the times are my estimate from the last output (the raw values, 940 s and 177 s, are kept as `wallSRaw` in the data). `bench/run.mjs` now has the same watchdog built in: it stops a run that has been silent for 2 minutes after its result.

The cost-only tables below are the earlier batch, with the 1.1.0 text in arm B (and, for the natural scenario, the 1.1.1 rerun of arm B).

### Results: delegate (plugin 1.1.0, 3 runs per arm, mean and min to max)

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

### Results: natural (3 runs per arm; 1.1.0 and the 1.1.1 rerun)

| | A: no plugin | B: 1.1.0 policy | Change vs A | B: 1.1.1 policy (rerun) | Change vs A |
|---|---|---|---|---|---|
| Runs passed | 3/3 | 3/3 | | 3/3 | |
| Cost, USD | 0.24 (0.21 to 0.26) | 0.31 (0.25 to 0.35) | +31% | 0.23 (0.22 to 0.24) | -1% |
| Wall time, s | 19 (17 to 21) | 38 (18 to 48) | +99% | 20 (19 to 20) | +4% |
| Sub-agents started | 0 (0 to 0) | 2.7 (0 to 5) | | 0 (0 to 0) | |
| Main agent API calls | 4 (4 to 4) | 8.3 (4 to 11) | | 4.3 (4 to 5) | |

This is the finding to take away: **when the prompt only allowed delegation, the baseline never delegated** (0 of 3). The opus main agent read the 200-line source in two commands and said that sub-agents "would cost more than they'd save here". With the 1.1.0 plugin it started scouts in 2 of 3 runs and finished more slowly and more expensively, because every sub-agent that finishes wakes the main agent for another call, and on a repo this small that overhead is bigger than the haiku work it saves. In the one 1.1.0 run that did not delegate, the cost was $0.25 against $0.21 to $0.26 for the baseline, so the plugin's own context overhead is within noise at this size.

I read that as the plugin text nudging delegation, so 1.1.1 adds one line at the top of `policy.md` ("This only picks the model for delegation you would do anyway; it is not a reason to delegate. Do small or quick tasks yourself.") and the same idea in the two agent descriptions. Rerun of arm B only, with the same fixture, prompt and flags except `--max-budget-usd 1` instead of 5 (a spending cap for this rerun; no run came near it): the main agent did the task itself in 3 of 3 runs, at baseline cost and speed. Arm A was not rerun, since the baseline did not change. Limits: 3 runs, and going from 2 of 3 runs delegating to 0 of 3 is suggestive, not proof that the line is the cause. I did not rerun the delegate scenario with 1.1.1, so the -54% above is a 1.1.0 number; the new line may make the main agent delegate less there too, and I have not measured that.

The plugin saves money on delegated work only. On a task small enough that the main agent does it alone, it saves nothing; with 1.1.0 it could tip the agent into delegating and cost more.

### Every run

| Scenario | Run | Arm | Tests | Cost | Time | Sub-agents (model/effort) |
|---|---|---|---|---|---|---|
| natural | 1 | A | 45/45 | $0.21 | 21 s | none |
| natural | 1 | B | 45/45 | $0.33 | 47 s | 3 x scout haiku/low |
| natural | 2 | A | 45/45 | $0.26 | 17 s | none |
| natural | 2 | B | 45/45 | $0.35 | 48 s | 5 x scout haiku/low |
| natural | 3 | A | 45/45 | $0.23 | 19 s | none |
| natural | 3 | B | 45/45 | $0.25 | 18 s | none |
| natural (v1.1.1 policy) | 1 | B | 45/45 | $0.24 | 20 s | none |
| natural (v1.1.1 policy) | 2 | B | 45/45 | $0.22 | 20 s | none |
| natural (v1.1.1 policy) | 3 | B | 45/45 | $0.24 | 19 s | none |
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

The Codex plugin in that run was the copy installed at version 1.0.0; `policy-codex.md` and the Codex hooks are unchanged in 1.1.0 and 1.1.1 (it already says the plugin never asks Codex to delegate more). Data: `bench/results/codex.json`.

### Caveats

- Small n: 3 runs per arm and scenario, one Codex pair. Read the spread as noise-level information, not as a confidence interval.
- One fixture, and a tiny one (about 200 lines of source). On a large repo the sub-agents would read much more, so I expect more saving from routing, but I did not measure that.
- The delegate prompt tells the agent to delegate. A real session may delegate more or less than that.
- Costs are list-price equivalents from `total_cost_usd`. Subscription usage limits are counted differently and the ratios may differ. The plan's own meter was too coarse to confirm them (1% steps), and weighted tokens are a proxy for it, not the same quantity: I do not know how the plan weighs cache reads or each model.
- Plan usage was read on one account with a weekly-only limit; on a plan with a five-hour window you would see that figure as well, and the five-hour meter may be finer.
- One model family and one Claude Code version. The sub-agent models in arm A were opus because Explore and general-purpose inherit the main model in this setup; with other settings or versions the baseline could already be cheaper.
- Prompt caching can shift individual runs; the alternating order is there to spread it, not to remove it.
- The two bugs are easy to find on purpose, so every run passed. This benchmark measures cost, not whether cheaper models fail on harder bugs.

### What the benchmark cost

- First batch: 12 runs, $6.98 (arm A $4.37, arm B with 1.1.0 text $2.61).
- 1.1.1 natural rerun of arm B: 3 runs, $0.70.
- Usage batch: 12 runs, **$6.71 list-equivalent and 4.66M weighted tokens**, which moved the weekly limit from 94% to 95% (at most 2 points, and that includes whatever else was running on the account). No five-hour window exists on this account.
- All 27 Claude runs: $14.39. Manual checks (smoke sessions, the frontmatter and `CLAUDE_CODE_SUBAGENT_MODEL` tests, the statusline check) added about $0.8, so about $15.2 in list-price terms. On the weekly meter the whole benchmark can have used at most 2 points: the first stream event of the first batch showed 93% and the last reading of the usage batch was 95% (the early stream readings lag and I did not read `/usage` then, so I do not split that between batches).
- The Codex pair used about 2.3M tokens and has no dollar figure.

### Run it yourself

```
node bench/run.mjs --scenario natural  --runs 3 --out /tmp/mr-bench
node bench/run.mjs --scenario delegate --runs 3 --out /tmp/mr-bench
node bench/run.mjs --scenario natural --arms B --tag v1.1.1 --runs 3 --budget 1 --cap 3 --out /tmp/mr-bench-v111   # plugin arm only
node bench/run.mjs --scenario natural --tag v1.1.1-usage --runs 3 --budget 3 --cap 15 --stop-weekly 97 --out /tmp/mr-bench-usage   # with plan usage readings, A and B
node bench/run.mjs --scenario delegate --tag v1.1.1-usage --runs 3 --budget 3 --cap 15 --stop-weekly 97 --out /tmp/mr-bench-usage
node bench/run.mjs --summarize /tmp/mr-bench/results.json
node bench/codex.mjs --scenario delegate        # optional, Codex
```

It needs `claude` (logged in; only `~/.claude/.credentials.json` is copied, set `CLAUDE_CREDENTIALS` to use another file), `node`, and about $7 of API-equivalent usage for the first two commands. `--budget` caps each run (default $5), `--cap` stops the whole benchmark (default $25), `--stop-weekly N` stops it when the weekly limit is N% used, and `--settle` is the wait in seconds before each after-run usage reading (default 15). Every run records the `/usage` readings, so a rerun on your own plan gives you your own numbers; expect to see the weekly meter move by whole points only. Nothing from your real config is used and the throwaway directories are deleted at the end. The scripts never write credentials anywhere else.

## Honest notes

- The saving is measured on one tiny fixture and 3 runs per arm (see [Benchmark](#benchmark)): about half the price-weighted usage and cost when the main agent delegates a lot, and no saving (a few percent extra) when it does not. Version 1.1.0 also cost more on a small task by tipping the agent into delegating; 1.1.1 added a line against that and 3 of 3 reruns then matched the baseline. I will not extrapolate a percentage to your work. It depends on how much of your work goes to sub-agents and how much of that is searching and reading.
- The policy is an instruction, not enforcement. Nothing blocks a call that picks the wrong model. On Claude Code the main agent followed it for all 29 sub-agents it started in the plugin arm; on Codex it followed it on 2 of 5.
- The `effort:` agent frontmatter field is undocumented (see [Effort on Claude Code](#effort-on-claude-code)).
- Tested: `claude plugin validate . --strict` (passes; its only warning is that the plugin has no icon), a local install into a throwaway config dir with `claude plugin details`, the hook commands run by hand (valid hook-output JSON, same text as the policy files), real `claude -p` sessions whose transcripts show the Agent tool calls and the models and efforts that ran, and a Codex local install plus one Codex session. Linux only. The hooks should work on macOS and Windows, since they only use `node` and forward slashes, but I have not run them there.

## Credit

Inspired by the common "use a cheap model for helpers" advice. The plugin layout follows [ponytail](https://github.com/DietrichGebert/ponytail).

## License

MIT, see [LICENSE](LICENSE).
