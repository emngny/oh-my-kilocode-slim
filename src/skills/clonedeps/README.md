# clonedeps

`clonedeps` is a bundled OpenCode skill for cloning a small set of important
dependency source repositories into a local ignored workspace so agents can read
library internals.

It is orchestrator-owned. The orchestrator delegates source discovery and URL/tag
resolution to `@librarian`, asks for approval, then runs the bundled script for
safe filesystem and clone operations.

## Commands

```bash
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs scan --root .
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs sync --root . --plan plan.json
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs status --root .
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs clean --root .
```

Cloned repositories live under `.slim/clonedeps/repos/` and are ignored by git.
After syncing, the orchestrator should add or update a concise
`## Cloned Dependency Source` section in the repo root `AGENTS.md` pointing
future agents to `.slim/clonedeps.json` and `.slim/clonedeps/repos/`.
