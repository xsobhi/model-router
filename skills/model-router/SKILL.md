---
name: model-router
description: Show the model-routing policy (which model each kind of sub-agent task gets) and how to change it. Use for /model-router, or when asked how sub-agent models are chosen.
---

Show the user the "Model routing (model-router)" policy from your session context, word for word, then add:

- It applies to sub-agents only. The main session keeps the model the user picked.
- To change a level for this session, the user can just say so ("use sonnet for tests").
- To change it for good, edit `policy.md` (Claude Code) or `policy-codex.md` (Codex) in a fork of github.com/xsobhi/model-router and install the fork.

If the policy is not in your context, the hooks are not running: on Codex the user has to trust them in `/hooks`; otherwise check that `node` is on PATH. Say so, and read the policy file from the plugin folder instead.
