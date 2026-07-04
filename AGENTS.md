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
