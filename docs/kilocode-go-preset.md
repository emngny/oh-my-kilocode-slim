# KiloCode Go Preset

`kilo-go` is a bundled generated preset for users who want to run the
Pantheon agents through KiloCode Go models instead of the default OpenAI setup.

The installer generates both `openai` and `kilo-go` presets. OpenAI stays
active by default unless you select KiloCode Go during install or switch to it
later.

Because the `kilo-go` preset uses GLM-5.1 for Chief and GLM is not
multimodal, installing with `--preset=kilo-go` also enables the Observer
agent and configures it with `kilo-go/kimi-k2.6` for visual analysis.

## Install with KiloCode Go Active

```bash
bunx @emngny/oh-my-kilocode-slim@latest install --preset=kilo-go
```

Then authenticate and refresh models:

```bash
kilo auth login
kilo models --refresh
```

## Switch at Runtime

If both presets are already in your config, switch from inside KiloCode:

```text
/preset kilo-go
```

See [Preset Switching](preset-switching.md) for the full runtime switching
workflow. If you originally installed with the default OpenAI preset, also add
`"disabled_agents": []` to your config and restart KiloCode so Observer is
available before switching to `kilo-go`.

`disabled_agents` is global, not per-preset. If you later switch back to OpenAI
and restart while keeping `"disabled_agents": []`, Observer will remain enabled
and use the default Observer model unless you configure one explicitly.

## Bundled Model Mapping

The generated `kilo-go` preset maps each specialist to a model tuned for its
role:

| Agent | Model |
|-------|-------|
| Chief | `kilo-go/glm-5.2` |
| Oracle | `kilo-go/qwen3.7-max` (`max`) |
| Librarian | `kilo-go/deepseek-v4-flash` |
| Explorer | `kilo-go/deepseek-v4-flash` |
| Designer | `kilo-go/kimi-k2.7-code` (`medium`) |
| Fixer | `kilo-go/deepseek-v4-flash` (`high`) |
| Observer | `kilo-go/kimi-k2.6` |

## Generated Config Shape

Your generated config includes `kilo-go` under `presets` and activates it by
setting the top-level `preset` field:

```jsonc
{
  "preset": "kilo-go",
  "disabled_agents": [],
  "presets": {
    "kilo-go": {
      "chief": { "model": "kilo-go/glm-5.2" },
      "oracle": {
        "model": "kilo-go/qwen3.7-max",
        "variant": "max"
      },
      "librarian": { "model": "kilo-go/deepseek-v4-flash" },
      "explorer": { "model": "kilo-go/deepseek-v4-flash" },
      "designer": {
        "model": "kilo-go/kimi-k2.7-code",
        "variant": "medium"
      },
      "fixer": {
        "model": "kilo-go/deepseek-v4-flash",
        "variant": "high"
      },
      "observer": { "model": "kilo-go/kimi-k2.6" }
    }
  }
}
```

For the complete configuration reference, see
[Configuration](configuration.md).
