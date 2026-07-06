/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { generateLiteConfig, MODEL_MAPPINGS } from './providers';

describe('providers', () => {
  test('MODEL_MAPPINGS includes supported providers', () => {
    const keys = Object.keys(MODEL_MAPPINGS);
    expect(keys.toSorted((a, b) => a.localeCompare(b))).toEqual(['custom']);
  });

  test('generateLiteConfig defaults to custom and includes generated presets', () => {
    const config = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
    });

    expect(config.$schema).toBe(
      'https://unpkg.com/@emngny/oh-my-kilocode-slim@latest/oh-my-kilocode-slim.schema.json',
    );
    expect(config.preset).toBe('custom');
    expect(config.disabled_agents).toBeUndefined();
    const agents = (config.presets as any).custom;
    expect(agents).toBeDefined();
    expect(agents.chief.model).toBe('');
    expect(agents.chief.skills).toEqual(['*']);
    expect(agents.fixer.model).toBe('');
  });

  test('generateLiteConfig rejects unsupported preset', () => {
    expect(() =>
      generateLiteConfig({
        hasTmux: false,
        installCustomSkills: false,
        preset: 'not-real',
        backgroundSubagents: 'no',
        reset: false,
      }),
    ).toThrow('Unsupported preset "not-real"');
  });

  test('generateLiteConfig enables tmux when requested', () => {
    const config = generateLiteConfig({
      hasTmux: true,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
    });

    expect(config.tmux).toBeDefined();
    expect((config.tmux as any).enabled).toBe(true);
    expect((config.tmux as any).layout).toBe('main-vertical');
  });

  test('generateLiteConfig companion: yes', () => {
    const config = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
      companion: 'yes',
    });

    expect(config.companion).toBeDefined();
    expect((config.companion as any).enabled).toBe(true);
    expect((config.companion as any).position).toBe('bottom-right');
    expect((config.companion as any).size).toBe('medium');
  });

  test('generateLiteConfig companion: no or omitted', () => {
    const configYes = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
      companion: 'no',
    });
    expect(configYes.companion).toBeUndefined();

    const configOmitted = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
    });
    expect(configOmitted.companion).toBeUndefined();
  });

  test('generateLiteConfig includes default skills', () => {
    const config = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
    });

    const agents = (config.presets as any).custom;
    // Chief should always have '*'
    expect(agents.chief.skills).toEqual(['*']);

    // Oracle should have bundled simplify
    expect(agents.oracle.skills).toContain('simplify');

    // Chief should implicitly cover bundled codemap via '*'
    expect(agents.chief.skills).toContain('*');

    // Designer should have no bundled skills by default
    expect(agents.designer.skills).toEqual([]);

    // Explorer should have no bundled skills by default
    expect(agents.explorer.skills).toEqual([]);

    // Fixer should have no bundled skills by default
    expect(agents.fixer.skills).toEqual([]);
  });

  test('generateLiteConfig includes mcps field', () => {
    const config = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
    });

    const agents = (config.presets as any).custom;
    expect(agents.chief.mcps).toBeDefined();
    expect(Array.isArray(agents.chief.mcps)).toBe(true);
    expect(agents.librarian.mcps).toBeDefined();
    expect(Array.isArray(agents.librarian.mcps)).toBe(true);
  });

  test('generateLiteConfig custom includes correct mcps', () => {
    const config = generateLiteConfig({
      hasTmux: false,
      installCustomSkills: false,
      backgroundSubagents: 'no',
      reset: false,
    });

    const agents = (config.presets as any).custom;
    expect(agents.chief.mcps).toEqual(['*', '!context7']);
    expect(agents.librarian.mcps).toContain('websearch');
    expect(agents.librarian.mcps).toContain('context7');
    expect(agents.librarian.mcps).toContain('gh_grep');
    expect(agents.designer.mcps).toEqual([]);
  });
});
