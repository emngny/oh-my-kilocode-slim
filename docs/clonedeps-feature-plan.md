# Clonedeps Skill Feature Plan

## Goal

Add a bundled `clonedeps` skill that helps the orchestrator make important
dependency source code locally available to OpenCode. The skill should analyze a
project, identify a small number of core dependencies worth cloning, resolve the
official source repositories and versions, clone them into an ignored workspace,
and configure ignore files so the cloned source is readable by OpenCode without
being committed.

This is intentionally similar to the `codemap` skill: the model owns judgment
and planning, while a script owns deterministic filesystem state and repeatable
operations.

## Non-Goals

- Do not clone every dependency.
- Do not auto-run for every project on startup.
- Do not make cloned dependency source part of git history.
- Do not run install/build/test scripts inside cloned dependencies.
- Do not replace `@librarian` for ordinary docs/API lookup. Use this only when
  local source is materially useful.

## User Experience

Example prompts that should trigger the skill:

- "clone the important deps for this repo so opencode can read them"
- "I need to inspect dependency internals for this bug"
- "make the core library source available locally"
- "understand how this SDK works from source"

Expected flow:

1. Orchestrator loads `clonedeps`.
2. Orchestrator delegates planning/research to `@librarian`.
3. Librarian reads the current repo enough to identify important direct
   dependencies, researches official source repositories/tags, and returns a
   concise clone plan.
4. Orchestrator presents the plan and asks for confirmation unless the user
   explicitly requested immediate cloning.
5. Orchestrator runs the bundled script to sync selected dependencies.
6. Script writes state, updates ignore files, and performs safe clone/update
   operations.
7. Orchestrator adds or updates a concise `## Cloned Dependency Source` section
   in root `AGENTS.md` pointing future agents to `.slim/clonedeps.json` and
   `.slim/clonedeps/repos/`, with wording that the clones are local cache and
   may not exist in every checkout.

## Agent Ownership

The skill should be assigned to `orchestrator` only:

```ts
allowedAgents: ['orchestrator']
```

Inside the skill instructions, tell orchestrator to use `@librarian` for the
combined dependency-discovery and source-resolution phase:

```text
Ask @librarian to inspect this repo's dependency manifests and relevant imports,
then resolve official source repositories, tags/commits, package subdirectories,
and caveats for the dependencies worth cloning.
```

Rationale:

- Librarian is best positioned to research package source URLs, docs, release
  tags, and external repository structure.
- Orchestrator must own mutations: network clone commands, `.gitignore`,
  `.ignore`, and `.slim` state.
- This keeps user approval and safety checks in the main session.

## Repository Layout

Use `.slim` because the repo already uses it for skill state:

```text
.slim/
  clonedeps.json
  clonedeps/
    repos/
      npm/
        @scope__pkg/1.2.3/
        package/1.0.0/
```

State file shape, versioned for future migration:

```json
{
  "version": "1.0.0",
  "root": ".",
  "updatedAt": "2026-05-12T00:00:00.000Z",
  "dependencies": [
    {
      "ecosystem": "npm",
      "name": "@opencode-ai/sdk",
      "versionRange": "^1.3.17",
      "resolvedVersion": "1.3.17",
      "repoUrl": "https://github.com/.../...",
      "ref": "v1.3.17",
      "path": ".slim/clonedeps/repos/npm/@opencode-ai__sdk/1.3.17",
      "reason": "Core OpenCode session/runtime integration",
      "status": "cloned"
    }
  ]
}
```

## Ignore File Management

The script should update ignore files using idempotent marker blocks.

Feasibility check result: OpenCode's current file-list implementation reads
`.gitignore` first, then `.ignore`, and evaluates both with the `ignore` package
(`opencode/packages/opencode/src/file/index.ts`). Because later negated patterns
can unignore earlier ignored paths, the `.ignore` marker block below should make
the cloned tree visible to OpenCode even though `.gitignore` keeps it out of git.

`.gitignore`:

```gitignore
# BEGIN oh-my-opencode-slim clonedeps
.slim/clonedeps.json
.slim/clonedeps/repos/
# END oh-my-opencode-slim clonedeps
```

`.ignore`:

```ignore
# BEGIN oh-my-opencode-slim clonedeps
!.slim/
!.slim/clonedeps/
!.slim/clonedeps/repos/
!.slim/clonedeps/repos/**
.slim/clonedeps/repos/**/.git/
.slim/clonedeps/repos/**/.git/**
# END oh-my-opencode-slim clonedeps
```

`.slim/clonedeps.json` should probably be ignored too because it is local cache
state. If we later want shareable clone recommendations, use a separate explicit
file such as `.slim/clonedeps-plan.json` or a project doc.

## Script Interface

Add a bundled deterministic script:

```text
src/skills/clonedeps/scripts/clonedeps.mjs
```

Commands:

```bash
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs scan --root .
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs sync --root . --plan <plan.json>
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs status --root .
node ~/.config/opencode/skills/clonedeps/scripts/clonedeps.mjs clean --root .
```

Use `scan` for deterministic project metadata. Avoid naming it `plan`, because
the strategic clone plan is produced by the model/librarian.

Responsibilities:

- detect manifests/lockfiles for initial metadata;
- safely create `.slim/clonedeps/repos`;
- normalize package names into safe paths;
- write/read `.slim/clonedeps.json`;
- update `.gitignore` and `.ignore` marker blocks idempotently;
- clone shallow repositories at requested refs;
- avoid duplicate clones;
- report clear status and failure messages;
- never execute cloned dependency code.

The script should not decide strategic value on its own beyond simple metadata.
The model/librarian should choose which dependencies are worth cloning.

## Plan Schema and Trust Boundary

`sync --plan` consumes an LLM-assisted plan, so the script must treat it as
untrusted input. Define a strict schema and validate before cloning.

Draft plan input:

```json
{
  "version": "1.0.0",
  "dependencies": [
    {
      "ecosystem": "npm",
      "name": "@opencode-ai/sdk",
      "versionRange": "^1.3.17",
      "resolvedVersion": "1.3.17",
      "repoUrl": "https://github.com/example/repo.git",
      "ref": "v1.3.17",
      "packagePath": "packages/sdk/js",
      "reason": "Core OpenCode session/runtime integration"
    }
  ]
}
```

Validation rules:

- accept only supported ecosystems in MVP: `npm`;
- accept only HTTPS GitHub/GitLab-style URLs for MVP;
- reject `file://`, SSH, local paths, auth-bearing URLs, and path traversal;
- reject unpinned refs such as `main` unless the orchestrator explicitly asks
  the user to confirm an unverified branch fallback;
- enforce the max dependency count in the script;
- compute local clone paths inside the script; do not trust a plan-provided
  output path;
- verify refs with `git ls-remote` before clone when possible;
- record whether each cloned source is `exact`, `fallback`, or `unverified`.

Git execution rules:

- use `spawn` argument arrays, never shell-string interpolation;
- set `GIT_TERMINAL_PROMPT=0`;
- clone without submodules/recursive behavior;
- clone into a temporary directory, then atomically rename into place;
- apply timeouts;
- surface clear failure messages for auth/private repos.

## MVP Scope

Start with Node/Bun/npm projects only:

- `package.json`
- `bun.lock` / `bun.lockb`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`

Default selection policy:

- max 3-5 dependencies;
- direct dependencies only;
- include user-mentioned dependencies;
- prioritize frameworks, SDKs, ORMs, runtime/plugin APIs, build/runtime tools
  central to the task;
- exclude tiny utilities and transitive packages;
- exclude dev dependencies unless directly relevant;
- ask before huge monorepos.

For this repository, likely candidates are:

- `@opencode-ai/sdk`
- `@opencode-ai/plugin`
- `@modelcontextprotocol/sdk`
- maybe `@ast-grep/cli` / `@ast-grep/napi` when working on AST tools
- maybe `zod` when debugging schema/runtime validation behavior

## Skill Package Files

Add:

```text
src/skills/clonedeps/
  SKILL.md
  README.md
  scripts/clonedeps.mjs
  scripts/clonedeps.test.ts
```

`SKILL.md` should be concise and operational, following the `codemap` style.
The frontmatter description should strongly trigger on dependency-source tasks,
but avoid firing for ordinary docs lookup.

Draft description:

```yaml
name: clonedeps
description: Clone important project dependency source code into an ignored local workspace so OpenCode can inspect library internals. Use when the user asks to clone dependencies, inspect dependency/source internals, understand SDK/framework behavior from source, debug library implementation details, or make core dependency repos locally readable. Do not use for ordinary API/docs questions where @librarian is enough.
```

## Repository Integration

Implementation touch points:

- `src/skills/clonedeps/**` — new bundled skill payload.
- `src/cli/custom-skills.ts` — add `clonedeps` with
  `allowedAgents: ['orchestrator']`.
- `scripts/verify-release-artifact.ts` — ensure package tarball includes the new
  skill files.
- `src/skills/codemap.md` — update skill directory map after implementation.
- `README.md` / relevant docs — mention the new skill and safety behavior.

Likely tests:

- script unit tests for package-name path normalization;
- marker block insertion/update/removal;
- state-file load/save;
- scan output and sync-plan parsing;
- unsafe plan rejection: path traversal, unsupported URL schemes, too many deps,
  unpinned refs, and user-provided output paths;
- release artifact verification includes `clonedeps/SKILL.md`;
- release artifact verification includes `clonedeps/scripts/clonedeps.mjs`;
- skill permission generation includes orchestrator access only.

## Safety Constraints

- Ask for approval before network cloning unless user explicitly says to clone.
- Limit default plan to 3-5 repos.
- Prefer shallow clone and pinned tags/commits.
- Warn when repo is a very large monorepo.
- Never run package scripts from cloned repositories.
- Do not clone private/auth-required repositories without explicit user action.
- Do not overwrite user-authored ignore file content outside marker blocks.
- Keep clone state recoverable via `status` and `clean`.

## Open Questions

1. Should `sync` accept a JSON plan file only, or also CLI flags for single
   dependency sync?
2. Should the script support sparse checkout for monorepos in MVP, or defer?
3. Should cloned repos be under `.slim/clonedeps/repos` or a shorter root like
   `.deps-src` for easier manual browsing?
4. Should `clean` also remove the `AGENTS.md` section, or leave historical
   guidance for agents? MVP leaves it unless the user asks to remove it.

## Implementation Sequence

0. Verify `.ignore`/`.gitignore` precedence against OpenCode's file ignore
   implementation. This is complete for the current implementation by source
   inspection.
1. Define scan output, sync-plan, and state schemas.
2. Implement pure script helpers with tests: safe path names, marker blocks,
   schema validation, state load/save, and unsafe plan rejection.
3. Implement `clonedeps.mjs` with state, marker block, and dry-run/status
   behavior before clone operations.
4. Add clone behavior behind dry-run/fake-git tests, then real manual testing.
5. Create `src/skills/clonedeps/SKILL.md` and README.
6. Register skill in `CUSTOM_SKILLS` as orchestrator-only.
7. Update release verification and docs, including `docs/skills.md` if the
   bundled skill table exists there.
8. Manually test on this repo with a dry-run plan for OpenCode/MCP deps.

## Oracle Review Notes

Oracle reviewed this plan and gave a conditional go. The main blockers before
implementation are:

- verify `.ignore` visibility semantics first (completed by source inspection);
- define and validate the `sync --plan` schema before trusting LLM-produced
  clone data;
- make ref correctness explicit with `git ls-remote`, pinned refs, and recorded
  confidence states.

The review also recommended keeping the skill orchestrator-only, tightening git
safety rules in the script, and treating `.slim/clonedeps.json` as local ignored
state unless we intentionally design a shareable plan file.
