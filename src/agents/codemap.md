# src/agents/

## Responsibility

Defines agent personalities (Chief, Explorer, Librarian, etc.) and manages their configuration lifecycle. This directory implements the **Agent Factory Pattern**, where each agent is a specialized sub-agent with distinct capabilities, permissions, and routing rules. The Chief agent (src/agents/index.ts) coordinates task delegation to these specialists.

## Design

### Agent Types and Factories

Each agent is a **prompt-driven specialist** with a factory function that creates an `AgentDefinition`:

| Agent | Factory | Role | Permissions | Model Default |
|-------|---------|------|-------------|---------------|
| **chief** | `createChiefAgent()` | Workflow manager that delegates tasks to specialists | Primary agent with full tool access | Resolved from config or runtime preset |
| **explorer** | `createExplorerAgent()` | Fast codebase search and pattern matching | Read-only (glob, grep, ast_grep_search) | DEFAULT_MODELS.explorer |
| **librarian** | `createLibrarianAgent()` | External documentation and library research | Read-only (context7, gh_grep, websearch) | DEFAULT_MODELS.librarian |
| **oracle** | `createOracleAgent()` | Strategic technical advisor and code reviewer | Read-only (read, glob, grep, ast_grep_search) | DEFAULT_MODELS.oracle |
| **designer** | `createDesignerAgent()` | UI/UX design, review, and implementation | Read/write (read, glob, grep, write, edit) | DEFAULT_MODELS.designer |
| **fixer** | `createFixerAgent()` | Fast implementation specialist for bounded tasks | Read/write (read, glob, grep, write, edit) | DEFAULT_MODELS.fixer |
| **observer** | `createObserverAgent()` | Visual analysis specialist (images, PDFs, diagrams) | Read-only (read, glob, grep, ast_grep_search) | DEFAULT_MODELS.observer |
| **council** | `createCouncilAgent()` | Multi-LLM consensus engine for high-stakes decisions | Read-only + council_session tool | DEFAULT_MODELS.council |
| **councillor** | `createCouncillorAgent()` | Read-only council advisor (internal use only) | Read-only (read, glob, grep, ast_grep_search) | Inherited from council |

### Configuration System

- **Default prompts**: Each agent factory has a base prompt defined in its file (e.g., `explorer.ts`, `oracle.ts`)
- **User overrides**: From `~/.config/kilo/oh-my-kilocode-slim.json` via `loadAgentPrompt()`
- **Permission wildcards**: Applied via `applyDefaultPermissions()` in `index.ts`
- **Model resolution**: Supports both string models and priority-ordered arrays (`_modelArray`) for runtime fallback
- **Skill permissions**: Per-agent MCP and tool access controlled via `getSkillPermissionsForAgent()`

### Agent Lifecycle

1. **Agent creation**: `createAgents(config)` instantiates all agents with merged configuration
2. **Permission application**: `applyDefaultPermissions()` sets read/write permissions based on agent type
3. **Display name injection**: Chief prompt rewrites `@agent` mentions to user-configured display names
4. **Configuration export**: `getAgentConfigs()` converts `AgentDefinition` to KiloCode SDK format with classification metadata

## Flow

### Agent Instantiation Sequence (src/agents/index.ts)

```typescript
// 1. Gather sub-agent definitions with custom prompts
const protoSubAgents = Object.entries(SUBAGENT_FACTORIES)
  .filter(([name]) => !disabled.has(name))
  .map(([name, factory]) => {
    const customPrompts = loadAgentPrompt(name, config?.preset);
    return factory(getModelForAgent(name), customPrompts.prompt, customPrompts.appendPrompt);
  });

// 2. Apply overrides and default permissions
const builtInSubAgents = protoSubAgents.map((agent) => {
  const override = getAgentOverride(config, agent.name);
  if (override) applyOverrides(agent, override);
  applyDefaultPermissions(agent, override?.skills, config?.disabled_skills);
  return agent;
});

// 3. Create Chief (with its own overrides and custom prompts)
const chief = createChiefAgent(
  chiefModel,
  chiefPrompts.prompt,
  chiefPrompts.appendPrompt,
  disabled,
);
applyDefaultPermissions(chief, chiefOverride?.skills, config?.disabled_skills);

// 4. Collect display names and inject into chief prompt
const displayNameMap = new Map<string, string>();
// ... populate from chief and all subagents ...
injectDisplayNames(chief, displayNameMap);

// 5. Return agents array [chief, ...allSubAgents]
return [chief, ...allSubAgents];
```

### Agent Configuration Export

```typescript
export function getAgentConfigs(config?: PluginConfig): Record<string, SDKAgentConfig> {
  const agents = createAgents(config);
  
  const applyClassification = (name: string, sdkConfig: SDKAgentConfig) => {
    if (name === 'council') {
      sdkConfig.mode = 'all'; // Primary + subagent
    } else if (name === 'councillor') {
      sdkConfig.mode = 'subagent';
      sdkConfig.hidden = true; // Internal only
    } else if (isSubagent(name)) {
      sdkConfig.mode = 'subagent';
    } else if (name === 'chief') {
      sdkConfig.mode = 'primary';
    }
  };
  
  // Build SDK config with classification and MCP permissions
  const entries: Array<[string, SDKAgentConfig]> = [];
  for (const a of agents) {
    const sdkConfig = { ...a.config, description: a.description };
    applyClassification(a.name, sdkConfig);
    
    // Handle display names: create both displayName and hidden alias
    if (a.displayName) {
      entries.push([normalizeDisplayName(a.displayName), sdkConfig]);
      entries.push([a.name, { ...sdkConfig, hidden: true }]);
    } else {
      entries.push([a.name, sdkConfig]);
    }
  }
  
  return Object.fromEntries(entries);
}
```

### Model Resolution and Fallback

- **Priority arrays**: When `model` is configured as an array in user config, it's stored as `_modelArray`
- **Runtime fallback**: ForegroundFallbackManager resolves models at runtime when API errors occur
- **Preset overrides**: Runtime presets can override model/variant/temperature per agent

## Integration

### Consumed by src/index.ts

The main plugin entry point (`src/index.ts`) consumes the agent system:

```typescript
import { createAgents, getAgentConfigs, getDisabledAgents } from './agents';

// During plugin initialization:
const disabledAgents = getDisabledAgents(config);
const agentDefs = createAgents(config);
const agents = getAgentConfigs(config);

// Register with KiloCode SDK
return {
  name: 'oh-my-kilocode-slim',
  agent: agents, // SDK agent configs
  tool: tools,  // Tools including council tools
  mcp: mcps,    // MCP servers
  config: async (kiloConfig) => { /* merge agent configs */ },
  event: async (input) => { /* session tracking, TUI state */ },
};
```

### Key Integration Points

1. **Agent selection**: KiloCode selects the chief as the primary agent
2. **Task delegation**: Chief uses `task()` with `subagent_type` to delegate to specialists
3. **Session tracking**: `sessionAgentMap` tracks which agent owns each session for TUI prompts
4. **Model resolution**: ForegroundFallbackManager handles runtime model switching for rate limits
5. **Permission system**: MCP permissions are injected based on agent's `mcps` list

### Routing Rules (src/agents/chief.ts)

The chief's system prompt contains dynamic routing rules that reference agent capabilities:

- **@explorer**: Fast codebase recon, parallel searches
- **@librarian**: Library research, web search
- **@oracle**: Architecture decisions, code review
- **@designer**: UI/UX design and polish
- **@fixer**: Bounded implementation tasks
- **@observer**: Visual/media analysis
- **@council**: Multi-model consensus for high-stakes decisions

These rules are filtered based on disabled agents and injected into the chief's prompt at startup.

## File Structure

- `index.ts` - Main agent factory and configuration system
- `chief.ts` - Chief agent definition and prompt builder
- `explorer.ts` - Fast codebase search specialist
- `librarian.ts` - Documentation and library research specialist
- `oracle.ts` - Architecture and code review specialist
- `designer.ts` - UI/UX design specialist
- `fixer.ts` - Implementation execution specialist
- `observer.ts` - Visual analysis specialist
- `council.ts` - Multi-LLM council agent
- `councillor.ts` - Read-only council advisor (internal)
- `permissions.ts` - Permission factory for read-only agents

## Design Patterns

- **Factory Pattern**: Each agent has a factory function that creates its `AgentDefinition`
- **Strategy Pattern**: Different agents implement different strategies for different tasks
- **Decorator Pattern**: Configuration decorators (overrides, permissions, display names) wrap agent definitions
- **Observer Pattern**: Session tracking via `sessionAgentMap` and event handlers
- **Chain of Responsibility**: Task delegation flows from chief to specialists