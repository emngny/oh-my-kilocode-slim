# Configuration Reference

Complete reference for all configuration files and options in oh-my-kilocode-slim. For repository-specific configurations, custom agents, and prompt directory lookups, see the [Project-local Customization Guide](project-local-customization.md).

---

## Config Files

| File | Purpose |
|------|---------|
| `~/.config/kilo/kilo.json` | KiloCode core settings (plugin registration, providers) |
| `~/.config/kilo/oh-my-kilocode-slim.json` | Plugin settings - agents, multiplexer, MCPs, council |
| `~/.config/kilo/oh-my-kilocode-slim.jsonc` | Same, but with JSONC (comments + trailing commas). Takes precedence over `.json` if both exist |
| `.kilo/oh-my-kilocode-slim.json` | Project-local overrides (optional, higher precedence than user config) |

> **💡 JSONC recommended:** Use the `.jsonc` extension to add comments and trailing commas. If both `.jsonc` and `.json` exist, `.jsonc` takes precedence.

Set `KILOCODE_CONFIG_DIR` to use a custom user config directory instead of
`~/.config/kilo`; install and runtime config discovery both honor it.

Set `OH_MY_KILOCODE_SLIM_DISABLE` to `1`, `true`, `yes`, or `on` to make
oh-my-kilocode-slim return during startup without registering agents, tools,
MCPs, hooks, Companion, or the TUI sidebar. This is a temporary escape hatch:

```bash
OH_MY_KILOCODE_SLIM_DISABLE=1 kilo
```

If OMK-slim detects an invalid plugin config for the current project, the TUI sidebar shows a warning. Run `oh-my-kilocode-slim doctor` from your project root for full diagnostics.

---

## Prompt Overriding

Customize agent prompts without modifying source code. Create markdown files in `~/.config/kilo/oh-my-kilocode-slim/`:

| File | Effect |
|------|--------|
| `{agent}.md` | Replaces the agent's default prompt entirely |
| `{agent}_append.md` | Appends custom instructions to the default prompt |

When a `preset` is active, the plugin checks preset directories before falling back to root directories. Both global user prompt directories and project-local prompt directories are searched. For the complete lookup precedence order, see [Project-local Customization](project-local-customization.md).

**Example directory structure:**

```
~/.config/kilo/oh-my-kilocode-slim/
  ├── best/
  │   ├── chief.md        # Preset-specific override (used when preset=best)
  │   └── explorer_append.md
  ├── chief.md            # Fallback override
  ├── chief_append.md
  ├── explorer.md
  └── ...
```

Both `{agent}.md` and `{agent}_append.md` can coexist - the full replacement takes effect first, then the append. If neither exists, the built-in default prompt is used.

---

## JSONC Format

All config files support **JSONC** (JSON with Comments):

- Single-line comments (`//`)
- Multi-line comments (`/* */`)
- Trailing commas in arrays and objects

**Example:**

```jsonc
{
  // Active preset
  "preset": "openai",

  /* Agent model mappings */
  "presets": {
    "openai": {
      "oracle": { "model": "openai/gpt-5.5" },
      "explorer": { "model": "openai/gpt-5.4-mini" },
    },
  },

  "multiplexer": {
    "type": "tmux",
    "layout": "main-vertical",
  },
}
```

---

## Full Option Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | string | - | Active preset name (e.g. `"openai"`, `"best"`) |

### Runtime Preset Switching

Presets can also be switched at runtime without restarting using the `/preset` command. See [Preset Switching](preset-switching.md) for details.

| `presets` | object | - | Named preset configurations |
|-----------|--------|---|-----------------------------|
| `presets.<name>.<agent>.model` | string | - | Model ID in `provider/model` format |
| `presets.<name>.<agent>.temperature` | number | - | Temperature (0–2) |
| `presets.<name>.<agent>.variant` | string | - | Reasoning effort: `"low"`, `"medium"`, `"high"` |
| `presets.<name>.<agent>.displayName` | string | - | Custom user-facing alias for the agent (e.g. `"advisor"` for `oracle`) |
| `presets.<name>.<agent>.skills` | string[] | - | Skills the agent can use (`"*"`, `"!item"`, explicit list) |
| `presets.<name>.<agent>.mcps` | string[] | - | MCPs the agent can use (`"*"`, `"!item"`, explicit list) |
| `presets.<name>.<agent>.options` | object | - | Provider-specific model options passed to the AI SDK (e.g., `textVerbosity`, `thinking` budget) |
| `agents.<customAgent>.model` | string\|array | - | Required for custom agents inferred from unknown `agents` keys |
| `agents.<customAgent>.prompt` | string | - | Full execution prompt for a custom agent |
| `agents.<customAgent>.chiefPrompt` | string | - | Exact `@agent` block injected into the chief prompt; must start with `@<agent-name>` |
| `agents.<agent>.displayName` | string | - | Custom user-facing alias for the agent in the active config |
| `acpAgents.<name>.command` | string | - | Command for an external ACP-compatible agent; creates a wrapper subagent named `<name>` |
| `acpAgents.<name>.args` | string[] | `[]` | Arguments for the ACP agent command |
| `acpAgents.<name>.env` | object | `{}` | Extra environment variables for the ACP subprocess |
| `acpAgents.<name>.cwd` | string | session directory | Working directory override for this ACP subprocess; protocol paths should be absolute |
| `acpAgents.<name>.description` | string | - | Description shown to KiloCode and injected into the chief routing prompt |
| `acpAgents.<name>.prompt` | string | generated wrapper prompt | Optional full prompt for the lightweight wrapper subagent |
| `acpAgents.<name>.chiefPrompt` | string | generated routing block | Optional exact routing block injected into the chief prompt |
| `acpAgents.<name>.wrapperModel` | string | fixer default | Cheap KiloCode model used by the wrapper subagent that calls `acp_run` |
| `acpAgents.<name>.permissionMode` | string | `ask` | How ACP permission requests are handled: `ask`, `allow`, or `reject` |
| `acpAgents.<name>.timeoutMs` | integer | `0` | Timeout for a single ACP run in milliseconds. `0` disables the timeout so external agents can run indefinitely. Finite values can be up to `2147483647`ms (~24.8 days) |
| `disabled_agents` | string[] | `["observer"]` | Agent names to disable globally. Set to `[]` to enable Observer; this is global, not per-preset |
| `autoUpdate` | boolean | `true` | Automatically install plugin updates in the background; set to `false` for notification-only mode |
| `delegationMode` | enum | `"conservative"` | Controls how aggressively the Chief delegates to specialist agents. `"conservative"` handles small conversational and mechanical edits directly; `"aggressive"` dispatches almost every non-trivial task to subagents. See [Delegation Mode](#delegation-mode) |
| `multiplexer.type` | string | `"none"` | Multiplexer mode: `auto`, `tmux`, `zellij`, `herdr`, or `none` |
| `multiplexer.layout` | string | `"main-vertical"` | Layout preset: `main-vertical`, `main-horizontal`, `tiled`, `even-horizontal`, `even-vertical`. Tmux applies full layouts; Zellij and Herdr map `main-vertical` to right and `main-horizontal` to down |
| `multiplexer.main_pane_size` | number | `60` | Main pane size as percentage (20–80) for tmux main layouts; ignored by Zellij and Herdr |
| `multiplexer.zellij_pane_mode` | string | `"agent-tab"` | Zellij pane placement: `agent-tab` creates/reuses a dedicated `kilo-agents` tab; `current-tab` opens subagents as panes in the tab containing the parent KiloCode pane, falling back to the focused tab if the parent pane cannot be resolved |
| `tmux.enabled` | boolean | `false` | Legacy alias for `multiplexer.type = "tmux"` |
| `tmux.layout` | string | `"main-vertical"` | Legacy alias for `multiplexer.layout` |
| `tmux.main_pane_size` | number | `60` | Legacy alias for `multiplexer.main_pane_size` |
| `backgroundJobs.maxSessionsPerAgent` | integer | `2` | Maximum completed/reconciled reusable child sessions per specialist type in the current chief session (1–10). See [Session Management](session-management.md) |
| `backgroundJobs.readContextMinLines` | integer | `10` | Minimum number of lines read from a file before it appears in reusable background-job context (0–1000) |
| `backgroundJobs.readContextMaxFiles` | integer | `8` | Maximum number of recent read-context files shown per reusable child session (0–50) |
| `disabled_mcps` | string[] | `[]` | MCP server IDs to disable globally |
| `fallback.enabled` | boolean | `true` | Enable model failover on timeout/error |
| `fallback.timeoutMs` | number | `15000` | Time before aborting and trying next model |
| `fallback.retryDelayMs` | number | `500` | Delay between retry attempts |
| `fallback.retry_on_empty` | boolean | `true` | Treat silent empty provider responses (0 tokens) as failures and retry. Set `false` to accept empty responses |
| `council.presets` | object | - | **Required if using council.** Named councillor presets |
| `council.presets.<name>.<councillor>.model` | string | - | Councillor model |
| `council.presets.<name>.<councillor>.variant` | string | - | Councillor variant |
| `council.presets.<name>.<councillor>.prompt` | string | - | Optional role guidance for the councillor |
| `council.default_preset` | string | `"default"` | Default preset when none is specified |
| `council.timeout` | number | `180000` | Per-councillor timeout (ms) |
| `council.councillor_execution_mode` | string | `"parallel"` | Run councillors in `parallel` or `serial`; use `serial` for single-model setups |
| `council.councillor_retries` | number | `3` | Max retries per councillor on empty provider response (0–5) |
| `interview.maxQuestions` | integer | `2` | Max questions per interview round (1–10) |
| `interview.outputFolder` | string | `"interview"` | Directory where interview markdown files are written (relative to project root) |
| `interview.autoOpenBrowser` | boolean | `true` | Automatically open the interview UI in your default browser during interactive runs; suppressed in tests and CI |
| `interview.port` | integer | `0` | Interview server port (0–65535). `0` = OS-assigned random port (per-session mode). Any value > 0 enables [dashboard mode](interview.md#dashboard-mode) |
| `interview.dashboard` | boolean | `false` | Enable [dashboard mode](interview.md#dashboard-mode) on the default port (43211). Setting `port` > 0 also enables dashboard mode. If both are set, `port` takes precedence |
| `companion.enabled` | boolean | `false` | Enable/disable the floating window Rust companion |
| `companion.binaryPath` | string | - | Optional path to a custom companion binary to launch instead of the default install path |
| `companion.position` | string | `"bottom-right"` | The initial corner position of the companion window: `bottom-right`, `bottom-left`, `top-right`, or `top-left` |
| `companion.size` | string | `"medium"` | The default size preset of the companion window: `small` (80px), `medium` (120px), or `large` (160px) |

> **niri note:** `companion-v0.1.3` includes the fixed native companion release.
> To make it open as a bottom-right overlay, add a niri rule matching its stable
> `app-id`/title (`oh-my-kilocode-slim-companion`), for example:
>
> ```kdl
> window-rule {
>     match app-id=r"^oh-my-kilocode-slim-companion$"
>     match title=r"^oh-my-kilocode-slim-companion$"
>     open-floating true
>     open-focused false
>     default-floating-position x=16 y=16 relative-to="bottom-right"
> }
> ```

### ACP-connected agents

Use `acpAgents` to expose external Agent Client Protocol servers as optional
KiloCode subagents. The plugin creates a lightweight wrapper agent for each
entry. The wrapper calls the built-in `acp_run` tool, which starts the ACP
process, creates a session, sends the task, and returns the streamed result.
`command` is only the executable; put flags and subcommands in `args`.

See **[ACP Agents](acp-agents.md)** for the dedicated setup guide, auth notes,
and troubleshooting.

```jsonc
{
  "acpAgents": {
    "claude-research": {
      "command": "claude-code-acp",
      "args": [],
      "description": "Claude Code subscription agent for deep research",
      "wrapperModel": "openai/gpt-5.4-mini",
      "permissionMode": "ask",
      "timeoutMs": 300000
    },
    "gemini-acp": {
      "command": "gemini",
      "args": ["--experimental-acp"],
      "description": "Gemini CLI through ACP"
    }
  }
}
```

After restart, the chief can delegate to `@claude-research` or
`@gemini-acp`. Use safe names matching `^[a-z][a-z0-9_-]*$`; names cannot
conflict with built-in or custom agents. `permissionMode` controls ACP
permission requests, but the plugin still asks before launching the configured
subprocess.

### Council configuration note

- The **Council agent model** is configured like any other agent, for example in
  `presets.<name>.council.model`.
- The **councillor models** are configured separately under
  `council.presets.<name>.<councillor>.model`.
- Deprecated `council.master*` fields are legacy compatibility aliases only;
  do not use them in new configs.

### Manual Update Mode

Set `autoUpdate` to `false` if you want update notifications without automatic
`bun install` runs.

```jsonc
{
  "autoUpdate": false
}
```

With `autoUpdate` set to `false`, this becomes notification-only mode: you'll
see that a new version is available, but the plugin won't install it
automatically.

Auto-update never crosses major versions. For example, a 1.x install can
auto-update to a newer 1.x release, but it won't auto-install 2.x. When a newer
major is available, the plugin shows a migration command instead.

> Pinned plugin entries in `kilo.json` (for example
> `"oh-my-kilocode-slim@1.0.1"`) are the true version lock. Those stay pinned
> regardless of `autoUpdate`.

### Delegation Mode

The Chief's default behavior is **conservative** — it handles small conversational
replies and trivial mechanical edits directly, and only delegates when a task
clearly needs a specialist lane. This is the safest default because it
minimizes unnecessary session overhead.

`aggressive` mode flips that. The Chief treats itself as a pure orchestrator
and dispatches almost every non-trivial request to a subagent, even things it
could handle on its own. The reasoning is **cost**:

- Most subagents run on free or cheap models (`deepseek-free`, `gemini-flash`,
  `mimo-free`, etc.).
- The Chief is the expensive model.
- A small token increase (3–5x) on a free-tier subagent is usually much cheaper
  than the same tokens on a premium Chief model.
- Specialized prompts produce better lane-specific results.

```jsonc
// ~/.config/kilo/oh-my-kilocode-slim.json
{
  "delegationMode": "aggressive"
}
```

**Trade-offs**

| | Conservative (default) | Aggressive |
|---|---|---|
| Chief handles directly | Trivial conversational, single-line edits, quick lookups | Almost nothing non-conversational |
| Subagent dispatch | Only when the lane is clearly needed | Default for any non-trivial task |
| Token usage | Lower per task | Higher per task (3–5x) |
| $ cost (mixed free chief / free subagent) | Lower | Similar or lower |
| $ cost (premium chief / free subagent) | Higher | **Lower** (the main use case) |
| Wall-clock latency for multi-step tasks | Slower (chief does steps serially) | Faster (parallel subagents) |
| Context pollution | Less | More session boundaries |

**When to use `aggressive`**

- Your Chief model is paid and your subagents are free/cheap.
- You want a more hands-off orchestrator that doesn't try to answer
  architecture or library questions itself.
- Your tasks are usually multi-step and benefit from parallel fan-out.

**When to keep `conservative`**

- Your Chief model is already cheap/free.
- You want tight, fast loops where the overhead of a subagent session costs
  more than it saves.
- You're tuning prompts and want the Chief's reasoning visible in the main
  session, not hidden in child sessions.

The `delegationMode` value is also visible in the Chief's system prompt itself,
so you can verify the active mode by asking the Chief "what's your current
delegation mode?" after restarting a session.

### Background Job Management

Background job management is enabled by default and does not need to be present
in the starter config. Add `backgroundJobs` only if you want to tune how many
completed/reconciled child-agent sessions are reusable or how much read context is shown. See
[Session Management](session-management.md) for the concept, defaults, and
examples.

### Agent Display Names

Use `displayName` to give an agent a user-facing alias while keeping the
internal agent name unchanged.

```jsonc
{
  "agents": {
    "oracle": {
      "displayName": "advisor"
    },
    "explorer": {
      "displayName": "researcher"
    }
  }
}
```

With this config, users can refer to `@advisor` and `@researcher`, while the
plugin still routes them to `oracle` and `explorer` internally.

Notes:

- `displayName` works in both top-level `agents` overrides and inside `presets`
- `@` prefixes and surrounding whitespace are normalized automatically
- Display names must be unique
- Display names cannot conflict with internal agent names like `oracle` or `explorer`

### Custom Agents

Unknown keys under `agents` are treated as custom subagents. A custom agent needs
its own `model`, a normal `prompt`, and optionally an `chiefPrompt` that
teaches the chief exactly when to delegate to it.

```jsonc
{
  "agents": {
    "janitor": {
      "model": "github-copilot/gpt-5.5",
      "prompt": "You are Janitor. Audit codebase entropy, dead code, docs drift, naming inconsistencies, and unnecessary complexity. Prefer analysis and plans over direct edits.",
      "chiefPrompt": "@janitor\n- Role: Maintenance specialist for codebase cleanup and entropy reduction\n- **Delegate when:** after large refactors • cleanup/technical-debt review • dead code or docs drift is suspected\n- **Don't delegate when:** feature implementation • urgent debugging • UI/UX work"
    }
  }
}
```

Notes:

- Custom agent names must be safe identifiers such as `janitor` or `security-reviewer`
- Custom agents without a `model` are skipped with a warning
- Disabled custom agents are not registered or injected into the chief prompt

### Desktop Companion App

The desktop companion app provides a visual status overlay showing running and active agents. For quick installation instructions, binary paths, config defaults, and release information, see the full **[Desktop Companion Guide](companion.md)**.

Once installed, configure it in your `oh-my-kilocode-slim` settings:

```jsonc
{
  "companion": {
    "enabled": true,
    "position": "bottom-right", // optional: bottom-right, bottom-left, top-right, top-left
    "size": "medium"            // optional: small, medium, large
  }
}
```
