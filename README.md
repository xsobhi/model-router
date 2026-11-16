# model-router

A small plugin for Claude Code and Codex that sends each sub-agent task to the cheapest model that can do it well.

Usage limits get used up fast when every helper runs on your strongest model. Searching a repo or summarising a log does not need it. This plugin tells the main agent, at the start of every session and every sub-agent, which model to pick for which kind of task. The main session keeps whatever model you chose.

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
| Searching, reading, summarising files, logs and pages; simple lookups; mechanical checks | `haiku` (agent `model-router:scout`, read-only) | smallest, fastest model, low effort |
| Routine, well-specified work: code changes with a clear plan, tests, refactors, docs, builds | `sonnet` (agent `model-router:builder`) | the everyday workhorse, medium effort |
| Hard or risky work: stubborn bugs, architecture and planning, security, irreversible actions | `opus` | most capable model, high effort |

If unsure, the cheaper model goes first and the work escalates when it struggles. Sub-agents are told to pass the rule on to any agents they start.

How it works:

- `SessionStart` injects `policy.md` (Claude Code) or `policy-codex.md` (Codex) as additional context.
- `SubagentStart` injects the same text into each sub-agent.
- `agents/scout.md` (haiku, tools limited to Read, Grep, Glob, WebFetch, WebSearch) and `agents/builder.md` (sonnet) are ready-made helpers for the first two tiers. Claude Code only.
- `skills/model-router/SKILL.md` is the `/model-router` command.

### Codex: what it can and cannot do

Codex's plugin docs do not list agent roles as something a plugin can bundle, so the Codex side is instruction-only (no scout/builder agents). What exists, checked against codex-cli 0.162.1:

- Each `spawn_agent` call can carry its own `model` and `reasoning_effort`. The policy tells Codex to set them by tier, and to use only models and efforts that Codex lists as supported. It does not hard-code model names: the tiers are "smallest", "everyday" and "most capable", resolved against the catalog you actually have (`codex debug models` prints it).
- Codex's own `spawn_agent` text says not to set `model` unless the user asks, and it only spawns sub-agents when you or your project instructions ask for delegation. The policy states that you asked for tiered models by installing the plugin. Whether the model follows it is up to the model; I did not run a paid session to measure how often it does.
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

Fork the repo and edit `policy.md` (Claude Code) or `policy-codex.md` (Codex). Both are 200 to 270 tokens; keep them short, because they are paid for on every session and every sub-agent.

- Change which model a tier uses, or add a tier, by editing the bullets.
- Codex: the "tier map" line at the bottom of `policy-codex.md` can pin exact model ids instead of `auto`.
- The agents' models are the `model:` line in `agents/*.md`.

Then install your fork: `/plugin marketplace add <you>/model-router`.

## Uninstall

```
/plugin uninstall model-router@model-router
```

or `claude plugin uninstall model-router@model-router`, then `claude plugin marketplace remove model-router`. On Codex: `codex plugin remove model-router@model-router`, then `codex plugin marketplace remove model-router`.

## Token cost

Measured on Claude Code 2.1.326 with `claude plugin details model-router` in a throwaway config dir:

- Always on: about 135 tokens (the skill and the two agent descriptions).
- `claude plugin details` marks the hooks as "harness-only, no model context cost". That is true for running them, but what they print does enter the context: `policy.md` is 843 bytes, roughly 200 tokens, once per session and once per sub-agent started. `policy-codex.md` is 1,096 bytes, roughly 270 tokens. Those two figures are my estimate from byte counts, not a tokenizer measurement.

So the plugin costs a few hundred tokens up front and about 200 more per sub-agent. It pays for itself only if the routing moves real work to cheaper models.

## Honest notes

- No benchmark. I did not measure how much usage this saves, and I will not claim a percentage. The saving depends on how much of your work goes to sub-agents and on how much of that is searching and reading. If you rarely start sub-agents, you will see almost nothing.
- The policy is an instruction, not enforcement. Nothing blocks a call that picks the wrong model.
- Tested on Linux only: `claude plugin validate`, a local install in a throwaway config dir, the hook commands run by hand (valid hook-output JSON), and, for Codex, a local install plus Codex's own hook discovery. The hooks should work on macOS and Windows, since they only use `node` and forward slashes, but I have not run them there. No model session was run, so how well either model follows the policy is untested.

## Credit

Inspired by the common "use a cheap model for helpers" advice. The plugin layout follows [ponytail](https://github.com/DietrichGebert/ponytail).

## License

MIT, see [LICENSE](LICENSE).
