# src/skills/clonedeps/

## Responsibility

Command-style bundled OpenCode skill for local dependency source mirroring. It
provides prompt instructions plus a deterministic script that scans npm project
metadata, validates LLM-assisted clone plans, manages `.slim/clonedeps` state,
updates ignore marker blocks, and shallow-clones selected repositories.

## Design

- `SKILL.md` is the prompt contract loaded by OpenCode and assigned only to the
  orchestrator.
- `scripts/clonedeps.mjs` is a standalone Node ESM CLI with exported pure helper
  functions for testability.
- The skill uses a trust-boundary pattern: librarian/orchestrator can propose a
  plan, but the script validates URLs, refs, dependency counts, and clone paths.
- State is local cache data stored in `.slim/clonedeps.json`; clone contents live
  under `.slim/clonedeps/repos/`.

## Flow

1. Orchestrator runs `scan` to inspect package metadata.
2. Orchestrator asks librarian for a small source-resolution plan.
3. User approves the plan.
4. Orchestrator runs `sync --plan`, which validates input, updates ignore files,
   verifies refs where possible, clones to temp directories, then writes state.
5. Orchestrator updates root `AGENTS.md` with a concise
   `## Cloned Dependency Source` pointer to `.slim/clonedeps.json` and the clone
   directory.
6. `status` reports current state; `clean` removes managed clones/state and
   marker blocks.

## Integration

- Registered in `src/cli/custom-skills.ts` with orchestrator-only permission.
- Included in release verification via `scripts/verify-release-artifact.ts`.
- Documented in `docs/skills.md` and included in `src/skills/codemap.md`.
