/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureConfigDir,
  getConfigDir,
  getConfigJson,
  getConfigJsonc,
  getConfigSearchDirs,
  getExistingConfigPath,
  getKiloCodeConfigPaths,
  getLiteConfig,
} from './paths';

const n = (p: string | string[]) =>
  Array.isArray(p)
    ? p.map((x) => x.replace(/\\/g, '/'))
    : p.replace(/\\/g, '/');

describe('paths', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.KILOCODE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getConfigDir() uses KILOCODE_CONFIG_DIR when set', () => {
    process.env.KILOCODE_CONFIG_DIR = '/custom/directory';
    delete process.env.XDG_CONFIG_HOME;
    expect(n(getConfigDir())).toBe('/custom/directory');
  });

  test('getConfigDir() uses XDG_CONFIG_HOME when set', () => {
    delete process.env.KILOCODE_CONFIG_DIR;
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(n(getConfigDir())).toBe('/tmp/xdg-config/kilo');
  });

  test('getConfigDir() falls back to ~/.config when XDG_CONFIG_HOME is unset', () => {
    delete process.env.KILOCODE_CONFIG_DIR;
    delete process.env.XDG_CONFIG_HOME;
    const expected = join(homedir(), '.config', 'kilo');
    expect(n(getConfigDir())).toBe(n(expected));
  });

  test('getConfigSearchDirs() returns custom dir first, then default dir', () => {
    process.env.KILOCODE_CONFIG_DIR = '/custom/directory';
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';

    expect(n(getConfigSearchDirs())).toEqual([
      '/custom/directory',
      '/tmp/xdg-config/kilo',
    ]);
  });

  test('getConfigSearchDirs() de-duplicates identical dirs', () => {
    process.env.KILOCODE_CONFIG_DIR = '/tmp/xdg-config/kilo';
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';

    expect(n(getConfigSearchDirs())).toEqual(['/tmp/xdg-config/kilo']);
  });

  test('getKiloCodeConfigPaths() returns both json and jsonc paths', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(n(getKiloCodeConfigPaths())).toEqual([
      '/tmp/xdg-config/kilo/kilo.json',
      '/tmp/xdg-config/kilo/kilo.jsonc',
    ]);
  });

  test('getKiloCodeConfigPaths() respects KILOCODE_CONFIG_DIR', () => {
    process.env.KILOCODE_CONFIG_DIR = '/custom/directory';
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(n(getKiloCodeConfigPaths())).toEqual([
      '/custom/directory/kilo.json',
      '/custom/directory/kilo.jsonc',
    ]);
  });

  test('getConfigJson() returns correct path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(n(getConfigJson())).toBe('/tmp/xdg-config/kilo/kilo.json');
  });

  test('getConfigJsonc() returns correct path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(n(getConfigJsonc())).toBe('/tmp/xdg-config/kilo/kilo.jsonc');
  });

  test('getLiteConfig() returns correct path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(n(getLiteConfig())).toBe(
      '/tmp/xdg-config/kilo/oh-my-kilocode-slim.json',
    );
  });

  test('getLiteConfig() respects KILOCODE_CONFIG_DIR', () => {
    process.env.KILOCODE_CONFIG_DIR = '/custom/directory';
    expect(n(getLiteConfig())).toBe(
      '/custom/directory/oh-my-kilocode-slim.json',
    );
  });

  describe('getExistingConfigPath()', () => {
    let tmpDir: string;

    afterEach(() => {
      if (tmpDir && existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('returns .json if it exists', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'kilo-test-'));
      process.env.XDG_CONFIG_HOME = tmpDir;

      const configDir = join(tmpDir, 'kilo');
      ensureConfigDir();

      const jsonPath = join(configDir, 'kilo.json');
      writeFileSync(jsonPath, '{}');

      expect(n(getExistingConfigPath())).toBe(n(jsonPath));
    });

    test("returns .jsonc if .json doesn't exist but .jsonc does", () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'kilo-test-'));
      process.env.XDG_CONFIG_HOME = tmpDir;

      const configDir = join(tmpDir, 'kilo');
      ensureConfigDir();

      const jsoncPath = join(configDir, 'kilo.jsonc');
      writeFileSync(jsoncPath, '{}');

      expect(n(getExistingConfigPath())).toBe(n(jsoncPath));
    });

    test('returns default .json if neither exists', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'kilo-test-'));
      process.env.XDG_CONFIG_HOME = tmpDir;

      const jsonPath = join(tmpDir, 'kilo', 'kilo.json');
      expect(n(getExistingConfigPath())).toBe(n(jsonPath));
    });
  });

  test("ensureConfigDir() creates directory if it doesn't exist", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'kilo-test-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'kilo');

    expect(existsSync(configDir)).toBe(false);
    ensureConfigDir();
    expect(existsSync(configDir)).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
