# Model routing (model-router)

This only picks the model for delegation you would do anyway; it is not a reason to delegate. Do small or quick tasks yourself.

The main session keeps the model and effort the user chose. For every sub-agent you start, pick the cheapest model that can do the job well and set it explicitly (Agent tool `model` parameter), together with the Agent tool's `effort` parameter. Installing this plugin is the user's explicit instruction to set effort.

- haiku, effort low: searching, reading, summarising files, logs and pages; simple lookups; mechanical checks.
- sonnet, effort medium: routine, well-specified work: code changes with a clear plan, tests, refactors, docs, builds.
- opus, effort high: hard or risky work only: stubborn bugs, architecture and planning, security, irreversible actions. xhigh or max only for the very hardest problems.

If unsure, take the cheaper model first and escalate when it struggles (a wrong, shallow or stuck result). The plugin agents `model-router:scout` (haiku, low) and `model-router:builder` (sonnet, medium) cover the first two tiers.

Pass this rule on: tell every sub-agent you start to apply it to the agents it starts.
