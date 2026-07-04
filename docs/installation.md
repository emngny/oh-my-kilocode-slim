# Installation Guide

Complete installation instructions for oh-my-kilocode-slim.

## Table of Contents

- [For Humans](#for-humans)
- [For LLM Agents](#for-llm-agents)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## For Humans

### Quick Install

Run the interactive installer:

```bash
bunx oh-my-kilocode-slim@latest install
```

Or use non-interactive mode:

```bash
bunx oh-my-kilocode-slim@latest install --no-tui --skills=yes --background-subagents=yes
```

### Configuration Options

The installer supports the following options:

| Option | Description |
|--------|-------------|
| `--skills=yes|no` | Install bundled skills (default: yes) |
| `--companion=ask\|yes\|no` | Install and enable the desktop Companion (`ask` by default; prompt defaults to no) |
| `--preset=<name>` | Active generated config preset: `openai` or `kilo-go` (default: `openai`) |
| `--background-subagents=ask\|yes\|no` | Configure the required background-subagents environment export (`ask` by default; prompt defaults to yes) |
| `--background-subagents-target=<path>` | Write the background-subagents export to a specific shell/profile file |
| `--no-tui` | Non-interactive mode |
| `--dry-run` | Simulate install without writing files |
| `--reset` | Force overwrite of existing configuration |

### Background Subagents Environment Setup

Background orchestration is the default workflow. It depends on KiloCode's native
background subagents, which are enabled by this environment variable:

```bash
KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true
```

The installer asks before adding that export to your shell startup file. The
prompt defaults to `yes` because V2's default orchestration depends on it.

```bash
bunx oh-my-kilocode-slim@latest install
```

For non-interactive setup, pass the choice explicitly:

```bash
bunx oh-my-kilocode-slim@latest install --no-tui --background-subagents=yes
```

After the installer updates a shell startup file, restart your terminal or source
the file before launching KiloCode. Examples:

```bash
source ~/.zshrc
# or
source ~/.bashrc
```

For a one-shot manual launch without restarting your terminal:

```bash
KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true kilo
```

### Non-Destructive Behavior

By default, the installer is non-destructive. If an `oh-my-kilocode-slim.json` configuration file already exists, the installer will **not** overwrite it. Instead, it will display a message:

```
[i] Configuration already exists at ~/.config/kilo/oh-my-kilocode-slim.json. Use --reset to overwrite.
```

To force overwrite of your existing configuration, use the `--reset` flag:

```bash
bunx oh-my-kilocode-slim@latest install --reset
```

**Note:** When using `--reset`, the installer creates a `.bak` backup file before overwriting, so your previous configuration is preserved.

### After Installation

The installer generates both OpenAI and KiloCode Go presets, with OpenAI active by default (using variant-aware `gpt-5.5` and `gpt-5.4-mini` models, including `gpt-5.5 (medium)` for Chief, `gpt-5.5 (high)` for Oracle, `gpt-5.5 (low)` for Fixer, and `gpt-5.4-mini` variants for other specialists). To make KiloCode Go active during install, run `bunx oh-my-kilocode-slim@latest install --preset=kilo-go`. That preset uses GLM-5.1 for Chief, so the installer also enables Observer with `kilo-go/kimi-k2.6` for visual analysis. To switch providers later or build a mixed setup, use **[Configuration Reference](configuration.md)** for the full option reference and the preset docs for copyable examples.

The plugin safely reconciles bundled skills on startup and after successful
auto-updates. Missing bundled skills are installed, and previously managed skills
are updated only when their local files still match a known plugin-installed
version. If you customized a skill locally, the plugin preserves your active copy
and stages the new bundled version under
`~/.config/kilo/.oh-my-kilocode-slim/skill-updates/` for manual review.
Restart KiloCode after an auto-update to load the updated plugin and any changed
skills.

Then:

```bash
kilo auth login
# Select your provider and complete OAuth flow
```

```bash
kilo models --refresh
```

Open your generated config at `~/.config/kilo/oh-my-kilocode-slim.json`
and adjust models if needed.

Then run KiloCode and verify the agents:

```text
ping all agents
```

> **💡 Tip: Models are fully customizable.** The installer sets sensible defaults, but you can assign *any* model to *any* agent. Edit `~/.config/kilo/oh-my-kilocode-slim.json` (or `.jsonc` for comments support) to override models, adjust reasoning effort, or disable agents entirely.

### Alternative: Ask Any Coding Agent

Paste this into Claude Code, AmpCode, Cursor, or any coding agent:

```
Install and configure by following the instructions here:
https://raw.githubusercontent.com/alvinunreal/oh-my-kilocode-slim/refs/heads/master/README.md
```

---

## For LLM Agents

If you're an LLM Agent helping set up oh-my-kilocode-slim, follow these steps.

### Step 1: Check KiloCode Installation

```bash
kilo --version
```

If not installed, direct the user to https://kilo.ai/docs first.

### Step 2: Run the Installer

The installer generates OpenAI and KiloCode Go presets, with OpenAI active by default:

```bash
bunx oh-my-kilocode-slim@latest install --no-tui --skills=yes
```

**Examples:**
```bash
# Interactive install
bunx oh-my-kilocode-slim@latest install

# Non-interactive with bundled skills
bunx oh-my-kilocode-slim@latest install --no-tui --skills=yes --background-subagents=yes

# Make the generated KiloCode Go preset active
bunx oh-my-kilocode-slim@latest install --preset=kilo-go

# Non-interactive without skills
bunx oh-my-kilocode-slim@latest install --no-tui --skills=no

# Force overwrite existing configuration
bunx oh-my-kilocode-slim@latest install --reset
```

The installer automatically:
- Adds the plugin to `kilo.json` or `kilo.jsonc` in
  `$KILOCODE_CONFIG_DIR` when set, otherwise `~/.config/kilo`
- Disables default KiloCode agents
- Enables KiloCode LSP integration when no explicit `lsp` setting exists
- Configures `KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` when approved
- Generates agent model mappings in the same KiloCode config directory as
  `oh-my-kilocode-slim.json` (or `.jsonc`)

### Step 3: Authenticate with Providers

Ask user to run the following command. Don't run it yourself, it requires user interaction.

```bash
kilo auth login
# Select your provider and complete OAuth flow
```

### Step 4: Verify Installation

Ask the user to:

1. Authenticate: `kilo auth login`
2. Refresh models: `kilo models --refresh`
3. Restart the terminal or source the shell file updated by the installer
   (`source ~/.zshrc` or `source ~/.bashrc`), then start KiloCode: `kilo`
   - One-shot alternative: `KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true kilo`
4. Run: `ping all agents`

Verify all agents respond successfully.

**Crucial Advice for the User:**
- They can easily assign **different models to different agents** by editing `~/.config/kilo/oh-my-kilocode-slim.json` (or `.jsonc`).
- If they want to add a different provider later (KiloCode Go, Kimi, GitHub Copilot, ZAI), they can update this file manually. See **[Configuration Reference](configuration.md)** and the preset docs for examples.
- Read the generated `~/.config/kilo/oh-my-kilocode-slim.json` (or `.jsonc`) file to understand the current configuration.

---

## Troubleshooting

### Installer Fails

Check the expected config format:
```bash
bunx oh-my-kilocode-slim@latest install --help
```

Then manually create the config files at:
- `~/.config/kilo/oh-my-kilocode-slim.json` (or `.jsonc`)

### Configuration Already Exists

If the installer reports that the configuration already exists, you have two options:

1. **Keep existing config**: The installer will skip the configuration step and continue with other operations (like adding the plugin or installing skills).

2. **Reset configuration**: Use `--reset` to overwrite:
   ```bash
   bunx oh-my-kilocode-slim@latest install --reset
   ```
   A `.bak` backup file will be created automatically.

### Agents Not Responding

1. Check your authentication:
   ```bash
   kilo auth status
   ```

2. From your project root, verify your config file exists and is valid:
   ```bash
   bunx oh-my-kilocode-slim@latest doctor
   ```

3. Check that your provider is configured in `~/.config/kilo/kilo.json`

### Missing Background Task Tools

If background tasks never
return task IDs, or delegation behaves like a blocking foreground call:

1. Confirm KiloCode was launched with the environment variable:
   ```bash
   env | grep KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS
   ```
   It should show `KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`.

   Also use an KiloCode release that includes native background
   subagents; run `kilo --version` and update KiloCode if background tasks are missing.

2. Restart your terminal or source the shell file the installer updated, then
   start KiloCode again. Plain `kilo` is only sufficient after that
   environment is active.

3. For a quick manual test, launch KiloCode with a one-shot export:
   ```bash
   KILOCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true kilo
   ```

4. If shell setup was missing, rerun the installer:
   ```bash
   bunx oh-my-kilocode-slim@latest install
   ```

### Authentication Issues

If providers are not working:

1. Check your authentication status:
   ```bash
   kilo auth status
   ```

2. Re-authenticate if needed:
   ```bash
   kilo auth login
   ```

3. Verify your config file has the correct provider configuration:
   ```bash
   cat ~/.config/kilo/oh-my-kilocode-slim.json
   ```

### Editor Validation

Add a `$schema` reference to your config for autocomplete and inline validation:

```jsonc
{
  "$schema": "https://unpkg.com/oh-my-kilocode-slim@latest/oh-my-kilocode-slim.schema.json",
  // your config...
}
```

Works in VS Code, Neovim (with `jsonls`), and any editor that supports JSON Schema. Catches typos and wrong nesting immediately.

### Tmux Integration Not Working

Make sure you're running KiloCode with the `--port` flag and the port matches your `OPENCODE_PORT` environment variable:

```bash
tmux
export OPENCODE_PORT=4096
kilo --port 4096
```

See the [Multiplexer Integration Guide](multiplexer-integration.md) for more details.

---

## Uninstallation

1. **Remove the plugin from your KiloCode config**:

   Edit `~/.config/kilo/kilo.json` and remove `"oh-my-kilocode-slim"` from the `plugin` array.

2. **Remove configuration files (optional)**:
   ```bash
   rm -f ~/.config/kilo/oh-my-kilocode-slim.json
   rm -f ~/.config/kilo/oh-my-kilocode-slim.json.bak
   ```

3. **Remove skills (optional)**:
   ```bash
   rm -rf ~/.config/kilo/skills/simplify
   rm -rf ~/.config/kilo/skills/codemap
   rm -rf ~/.config/kilo/skills/clonedeps
   rm -rf ~/.config/kilo/skills/deepwork
   rm -rf ~/.config/kilo/skills/reflect
   rm -rf ~/.config/kilo/skills/worktrees
   rm -rf ~/.config/kilo/skills/oh-my-kilocode-slim
   ```
