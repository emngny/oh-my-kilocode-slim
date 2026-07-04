import { describe, expect, test } from 'bun:test';
import {
  AGGRESSIVE_DELEGATION_CHECK,
  buildChiefPrompt,
  CONSERVATIVE_DELEGATION_CHECK,
  createChiefAgent,
} from './chief';

describe('buildChiefPrompt', () => {
  test('default mode produces conservative delegation text', () => {
    const prompt = buildChiefPrompt();
    // Conservative-only phrase: "Review available agents and lane rules"
    expect(prompt).toContain('Review available agents and lane rules');
    // Aggressive-only phrase should NOT appear
    expect(prompt).not.toContain('MUST delegate to a specialist subagent');
  });

  test('conservative mode explicit produces conservative delegation text', () => {
    const prompt = buildChiefPrompt(undefined, 'conservative');
    expect(prompt).toContain('Review available agents and lane rules');
    expect(prompt).not.toContain('MUST delegate to a specialist subagent');
  });

  test('aggressive mode produces aggressive delegation text', () => {
    const prompt = buildChiefPrompt(undefined, 'aggressive');
    expect(prompt).toContain('MUST delegate to a specialist subagent');
    expect(prompt).toContain(
      'forbidden from using Edit, Read, Glob, Grep, Bash',
    );
    // Conservative-only phrase should NOT appear
    expect(prompt).not.toContain('Review available agents and lane rules');
  });

  test('aggressive mode routes to all seven subagents', () => {
    const prompt = buildChiefPrompt(undefined, 'aggressive');
    for (const agent of [
      '@explorer',
      '@librarian',
      '@oracle',
      '@fixer',
      '@designer',
      '@observer',
      '@council',
    ]) {
      expect(prompt).toContain(agent);
    }
  });

  test('aggressive mode includes the cheap/free-model rationale', () => {
    const prompt = buildChiefPrompt(undefined, 'aggressive');
    expect(prompt).toContain('deepseek-free');
    expect(prompt).toContain(
      'Default to background: true for independent tasks',
    );
  });

  test('conservative mode allows direct execution for trivial edits', () => {
    const prompt = buildChiefPrompt(undefined, 'conservative');
    expect(prompt).toContain(
      'direct execution is allowed when scheduling overhead would clearly dominate',
    );
    // Aggressive should NOT include the direct-exception clause
    const aggressive = buildChiefPrompt(undefined, 'aggressive');
    expect(aggressive).not.toContain(
      'direct execution is allowed when scheduling overhead',
    );
  });

  test('preserves agent filtering behavior across modes', () => {
    const withExplorer = buildChiefPrompt(undefined, 'conservative');
    const withoutExplorer = buildChiefPrompt(
      new Set(['explorer']),
      'aggressive',
    );
    // Distinctive line from the explorer's AGENT_DESCRIPTIONS entry
    // ("Lane: Fast codebase recon that returns compressed context")
    expect(withExplorer).toContain('Fast codebase recon');
    expect(withoutExplorer).not.toContain('Fast codebase recon');
  });

  test('constants contain expected marker phrases', () => {
    expect(CONSERVATIVE_DELEGATION_CHECK).toContain('## 3. Delegation Check');
    expect(AGGRESSIVE_DELEGATION_CHECK).toContain('## 3. Delegation Check');
  });
});

describe('createChiefAgent', () => {
  test('default delegationMode is conservative', () => {
    const agent = createChiefAgent();
    const prompt = agent.config.prompt ?? '';
    expect(prompt).toContain('Review available agents and lane rules');
    expect(prompt).not.toContain('MUST delegate to a specialist subagent');
  });

  test('aggressive mode propagates into the agent prompt', () => {
    const agent = createChiefAgent(
      undefined,
      undefined,
      undefined,
      undefined,
      'aggressive',
    );
    const prompt = agent.config.prompt ?? '';
    expect(prompt).toContain('MUST delegate to a specialist subagent');
    expect(prompt).toContain(
      'forbidden from using Edit, Read, Glob, Grep, Bash',
    );
  });
});
