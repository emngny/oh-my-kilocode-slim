# src/skills/clonedeps/

## Responsibility
Manages the cloning and management of read-only dependency source repositories into a local cache (`.slim/clonedeps/repos/`) for offline inspection and development. This skill ensures that cloned dependency sources are available for agents to inspect without requiring network access or external dependencies.

## Design
- **Read-only clones**: Dependencies are cloned into `.slim/clonedeps/repos/` and should not be modified.
- **Cache strategy**: Only clones if the repository is not already present or is out of date.
- **Agent integration**: Provides a utility function (`getClonedDepPath`) for other skills/agents to resolve the local path to a cloned dependency.
- **Configuration**: Uses a central configuration file (e.g., `clonedeps.jsonc`) to define which repositories to clone and their expected revisions.

## Flow
1. **Initialization**: On plugin load, the skill checks if the configured repositories are present in `.slim/clonedeps/repos/`.
2. **Cloning**: If a repository is missing or the revision does not match, the skill clones or updates the repository using `git clone --depth 1` and checks out the specified revision.
3. **Path resolution**: Other skills/agents call `getClonedDepPath(depName)` to retrieve the absolute path to the cloned repository for inspection or documentation generation.
4. **Error handling**: If cloning fails, the skill logs an error and continues, allowing the plugin to function without the cloned dependency.

## Integration
- **Consumed by**: Skills and agents that need to inspect dependency internals (e.g., `@librarian`, `@explorer`).
- **Depends on**: Git CLI, configuration loader, and error handling utilities.
- **Outputs**: Local filesystem paths to cloned repositories for use by other skills.
- **Example usage**:
  ```typescript
  const path = getClonedDepPath("opencode-ai__opencode");
  // Returns: /home/user/.slim/clonedeps/repos/opencode-ai__opencode
  ```

## Notes
- Cloned repositories are read-only and should not be edited.
- The cache directory (`.slim/clonedeps/`) is platform-specific and located in the user's home directory.
- This skill is primarily for development and debugging; it does not affect runtime behavior.