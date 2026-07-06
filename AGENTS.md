# Agent Coding Guidelines

## Project Overview

**oh-my-kilocode-slim** - KiloCode plugin: specialist-agent orchestration layer. TypeScript + Bun + Biome. ESM-only.

## Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Clean + build plugin, CLI, declarations, schema |
| `bun run typecheck` | TypeScript type checking (no emit) |
| `bun test` | Run all tests |
| `bun test -t "pattern"` | Run single test by name |
| `bun run check` | Biome auto-fix (lint + format + organize imports) |
| `bun run check:ci` | Biome check without auto-fix (CI mode) |
| `bun run lint` | Lint only |
| `bun run format` | Format only |
| `bun run dev` | Build and run with KiloCode |

**Verification order before commit:** `bun run check:ci` → `bun run typecheck` → `bun test`

## Code Style

- **Formatter/Linter:** Biome (`biome.json`)
- **Indent:** 2 spaces | **Width:** 80 chars | **Line endings:** LF
- **Quotes:** single | **Trailing commas:** always
- **Strict TS:** enabled | **No `any`:** warn (off in test files)
- **Module:** ESM (`"type": "module"`) | **Resolution:** bundler
- Biome auto-organizes imports on save
- Use Zod for runtime validation (already a dependency, **v4**)

## Build Entry Points

Build produces two plugin bundles from `src/`:
- `src/index.ts` → `dist/index.js` (main plugin bootstrap)
- `src/tui.ts` → `dist/tui.js` (TUI export)

CLI separately: `src/cli/index.ts` → `dist/cli/index.js`

Both `@kilocode/plugin` and `@kilocode/sdk` are **external** — never bundled.

## Project Structure

```
src/
├── agents/       # Agent factories (chief, specialist, council)
├── cli/          # CLI entry point + installer
├── companion/    # Companion binary manager + updater
├── config/       # Schema, loaders, presets, constants
├── council/      # Multi-LLM session orchestration
├── hooks/        # Runtime hooks (apply-patch, phase-reminder, etc.)
├── interview/    # /interview feature
├── loop/         # Loop session
├── mcp/          # MCP server definitions
├── multiplexer/  # Tmux/Zellij/herdr pane integration
├── skills/       # Bundled install-time skills
├── tools/        # Tool defs (council, smartfetch, ast-grep, preset)
└── utils/        # Shared helpers (tmux, logging, session, env)
```

## Tmux Session Lifecycle

Critical for preventing orphaned processes:

```
Launch:  session.create() → tmux pane → task runs
Complete: session.status (idle) → extract results → session.abort() → deleted → pane closed
Cancel:  cancel() → session.abort() → deleted → pane closed
```

**Key rules:**
- Always `session.abort()` AFTER extracting results (content preserved)
- Graceful shutdown: Ctrl+C → delay 250ms → kill-pane (`src/utils/tmux.ts`)
- `multiplexerSessionManager.onSessionDeleted()` must stay wired in `src/index.ts`

**Manual verification:**
```bash
bun run build
# Test with local fork in ~/.config/kilo/kilo.jsonc
# After tasks: ps aux | grep "kilo attach" | grep -v grep  # should return 0
```

## Cloned Dependency Source

Read-only repos under `.slim/clonedeps/repos/` for inspection (do not edit):
- `kilo-ai__kilo/` — KiloCode plugin + SDK internals
- `kilo/` — TypeScript runtime + background subagent support
- `modelcontextprotocol__typescript-sdk/` — MCP protocol
- `agentclientprotocol__agent-client-protocol/` — ACP protocol

## Debugging

**KiloCode logs:** `~/.local/share/kilo/log/` (Win: `%USERPROFILE%\.local\share\kilo\log`)
- Files: `YYYY-MM-DDTHHMMSS.log`, last 10 kept
- Debug level: `kilo --log-level DEBUG`

**Plugin logs:** `~/.local/share/kilo/log/oh-my-kilocode-slim.<timestamp>.log`

## Release

Dual-track: plugin (npm) + companion (GitHub release assets). Full process: `docs/release.md`
- Plugin tag: `v<version>` | Companion tag: `companion-v<version>`
- Companion version lives in `src/companion/companion-manifest.json`

# context-mode — MANDATORY routing rules

context-mode MCP tools available. Rules protect context window from flooding. One unrouted command dumps 56 KB into context.

## Think in Code — MANDATORY

Analyze/count/filter/compare/search/parse/transform data: **write code** via `ctx_execute(language, code)`, `console.log()` only the answer. Do NOT read raw data into context. PROGRAM the analysis, not COMPUTE it. Pure JavaScript — Node.js built-ins only (`fs`, `path`, `child_process`). `try/catch`, handle `null`/`undefined`. One script replaces ten tool calls.

## BLOCKED — do NOT attempt

### curl / wget — BLOCKED
Intercepted and replaced with error. Do NOT retry.
Use: `ctx_fetch_and_index(url, source)` or `ctx_execute(language: "javascript", code: "const r = await fetch(...)")`

### Inline HTTP — BLOCKED
`fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, `http.request(` — intercepted. Do NOT retry.
Use: `ctx_execute(language, code)` — only stdout enters context

### WebFetch — BLOCKED
Use: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)`

## REDIRECTED — use sandbox

### Bash (>20 lines output)
Bash ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`.
Otherwise: `ctx_batch_execute(commands, queries)` or `ctx_execute(language: "shell", code: "...")`

### Read (for analysis)
Reading to **Edit** → Read correct. Reading to **analyze/explore/summarize** → `ctx_execute_file(path, language, code)`.

### Grep — may flood context
Use `ctx_execute(language: "shell", code: "grep ...")` in sandbox.

## Tool selection

0. **MEMORY**: `ctx_search(sort: "timeline")` — after resume, check prior context before asking user.
1. **GATHER**: `ctx_batch_execute(commands, queries)` — runs all commands, auto-indexes, returns search. ONE call replaces 30+. Each command: `{label: "header", command: "..."}`.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — all questions as array, ONE call (default relevance mode).
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — sandbox, only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — store in FTS5 for later search.

## Parallel I/O batches

For multi-URL fetches or multi-API calls, **always** include `concurrency: N` (1-8):

- `ctx_batch_execute(commands: [3+ network commands], concurrency: 5)` — gh, curl, dig, docker inspect, multi-region cloud queries
- `ctx_fetch_and_index(requests: [{url, source}, ...], concurrency: 5)` — multi-URL batch fetch

**Use concurrency 4-8** for I/O-bound work (network calls, API queries). **Keep concurrency 1** for CPU-bound (npm test, build, lint) or commands sharing state (ports, lock files, same-repo writes).

GitHub API rate-limit: cap at 4 for `gh` calls.

## Subagent routing

Routing block auto-injected into subagent prompts. Bash-type subagents upgraded to general-purpose. No manual instruction needed.

## Output

Write artifacts to FILES — never inline. Return: file path + 1-line description.
Descriptive source labels for `ctx_search(source: "label")`.

## Session Continuity

Skills, roles, and decisions persist for the entire session. Do not abandon them as the conversation grows.

## Memory

Session history is persistent and searchable. On resume, search BEFORE asking the user:

| Need | Command |
|------|---------|
| What were we working on? | `ctx_search(queries: ["summary"], source: "compaction", sort: "timeline")` |
| What was the first request? | `ctx_search(queries: ["prompt"], source: "user-prompt", sort: "timeline")` |
| What did we decide? | `ctx_search(queries: ["decision"], source: "decision", sort: "timeline")` |
| What NOT to repeat? | `ctx_search(queries: ["rejected"], source: "rejected-approach")` |
| What constraints exist? | `ctx_search(queries: ["constraint"], source: "constraint")` |

DO NOT ask "what were we working on?" — SEARCH FIRST.
If search returns 0 results, proceed as a fresh session.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call `ctx_stats` MCP tool, display full output verbatim |
| `ctx doctor` | Call `ctx_doctor` MCP tool, run returned shell command, display as checklist |
| `ctx upgrade` | Call `ctx_upgrade` MCP tool, run returned shell command, display as checklist |
| `ctx purge` | Call `ctx_purge` MCP tool with confirm: true. Warns before wiping knowledge base. |

After /clear or /compact: knowledge base and session stats preserved. Use `ctx purge` to start fresh.

<!-- caveman-begin -->
Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
<!-- caveman-end -->

<!-- codebase-memory-mcp:start -->
# Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.
ALWAYS prefer MCP graph tools over grep/glob/file-search for code discovery.

## Priority Order
1. `search_graph` — find functions, classes, routes, variables by pattern
2. `trace_path` — trace who calls a function or what it calls
3. `get_code_snippet` — read specific function/class source code
4. `query_graph` — run Cypher queries for complex patterns
5. `get_architecture` — high-level project summary

## When to fall back to grep/glob
- Searching for string literals, error messages, config values
- Searching non-code files (Dockerfiles, shell scripts, configs)
- When MCP tools return insufficient results

## Examples
- Find a handler: `search_graph(name_pattern=".*OrderHandler.*")`
- Who calls it: `trace_path(function_name="OrderHandler", direction="inbound")`
- Read source: `get_code_snippet(qualified_name="pkg/orders.OrderHandler")`
<!-- codebase-memory-mcp:end -->
