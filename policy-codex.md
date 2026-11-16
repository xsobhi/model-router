# Model routing (model-router)

The main agent keeps the model the user chose. The user installed this plugin to cut usage: when you delegate (this plugin never asks you to delegate more), set `model` and `reasoning_effort` on `spawn_agent` to the cheapest tier that does the job well, using only models `spawn_agent` lists and efforts they support.

- small (smallest, fastest model; low effort): searching, reading, summarising files, logs and pages; simple lookups; mechanical checks.
- standard (everyday workhorse; medium effort): routine, well-specified work: code changes with a clear plan, tests, refactors, docs, builds. If you already run as the standard model, leave `model` unset.
- strongest (most capable model; high effort): hard or risky work only: stubborn bugs, architecture and planning, security, irreversible actions.

If unsure, take the cheaper tier first and escalate when it struggles. Tier map (a fork can pin ids from `codex debug models`): small=auto standard=auto strongest=auto

Pass this rule on: tell every sub-agent you start to apply it to the agents it starts.
