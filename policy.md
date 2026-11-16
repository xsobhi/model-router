# Model routing (model-router)

The main session keeps the model the user chose. For every sub-agent you start, pick the cheapest model that can do the job well and set it explicitly (Agent tool `model` parameter):

- haiku: searching, reading, summarising files, logs and pages; simple lookups; mechanical checks.
- sonnet: routine, well-specified work: code changes with a clear plan, tests, refactors, docs, builds.
- opus: hard or risky work only: stubborn bugs, architecture and planning, security, irreversible actions.

If unsure, take the cheaper model first and escalate when it struggles (a wrong, shallow or stuck result). The plugin agents `model-router:scout` (haiku, read-only) and `model-router:builder` (sonnet) cover the first two tiers.

Pass this rule on: tell every sub-agent you start to apply it to the agents it starts.
