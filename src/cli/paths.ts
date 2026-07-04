import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, normalize } from 'node:path';

function getDefaultKiloCodeConfigDir(): string {
  const userConfigDir = process.env.XDG_CONFIG_HOME
    ? process.env.XDG_CONFIG_HOME
    : join(homedir(), '.config');

  return join(userConfigDir, 'kilo');
}

function getCustomKiloCodeConfigDir(): string | undefined {
  const configDir = process.env.KILOCODE_CONFIG_DIR?.trim();
  return configDir || undefined;
}

function getCustomTuiConfigPath(): string | undefined {
  const configPath = process.env.KILOCODE_TUI_CONFIG?.trim();
  return configPath || undefined;
}

/**
 * Get the KiloCode plugin config directory.
 *
 * Resolution order:
 * 1. KILOCODE_CONFIG_DIR (custom KiloCode directory)
 * 2. XDG_CONFIG_HOME/kilo
 * 3. ~/.config/kilo
 */
export function getConfigDir(): string {
  const customConfigDir = getCustomKiloCodeConfigDir();
  if (customConfigDir) {
    return customConfigDir;
  }

  return getDefaultKiloCodeConfigDir();
}

/**
 * Get KiloCode config directories in read/search order.
 *
 * Resolution order:
 * 1. KILOCODE_CONFIG_DIR (if set)
 * 2. XDG_CONFIG_HOME/kilo or ~/.config/kilo
 *
 * Duplicate entries are removed.
 */
export function getConfigSearchDirs(): string[] {
  const dirs = [getCustomKiloCodeConfigDir(), getDefaultKiloCodeConfigDir()]
    .filter((dir): dir is string => Boolean(dir))
    .map((dir) => normalize(dir));

  return dirs.filter((dir, index) => dirs.indexOf(dir) === index);
}

export function getKiloCodeConfigPaths(): string[] {
  const configDir = getConfigDir();
  return [join(configDir, 'kilo.json'), join(configDir, 'kilo.jsonc')];
}

export function getConfigJson(): string {
  return getKiloCodeConfigPaths()[0];
}

export function getConfigJsonc(): string {
  return getKiloCodeConfigPaths()[1];
}

export function getLiteConfig(): string {
  return join(getConfigDir(), 'oh-my-kilocode-slim.json');
}

export function getLiteConfigJsonc(): string {
  return join(getConfigDir(), 'oh-my-kilocode-slim.jsonc');
}

export function getTuiConfig(): string {
  const customConfigPath = getCustomTuiConfigPath();
  if (customConfigPath) return customConfigPath;

  return join(getConfigDir(), 'tui.json');
}

export function getTuiConfigJsonc(): string {
  return join(getConfigDir(), 'tui.jsonc');
}

export function getExistingLiteConfigPath(): string {
  const jsonPath = getLiteConfig();
  if (existsSync(jsonPath)) return jsonPath;

  const jsoncPath = getLiteConfigJsonc();
  if (existsSync(jsoncPath)) return jsoncPath;

  return jsonPath;
}

export function getExistingTuiConfigPath(): string {
  const customConfigPath = getCustomTuiConfigPath();
  if (customConfigPath) return customConfigPath;

  const jsonPath = join(getConfigDir(), 'tui.json');
  if (existsSync(jsonPath)) return jsonPath;

  const jsoncPath = getTuiConfigJsonc();
  if (existsSync(jsoncPath)) return jsoncPath;

  return jsonPath;
}

export function getExistingConfigPath(): string {
  const jsonPath = getConfigJson();
  if (existsSync(jsonPath)) return jsonPath;

  const jsoncPath = getConfigJsonc();
  if (existsSync(jsoncPath)) return jsoncPath;

  return jsonPath;
}

export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

export function ensureTuiConfigDir(): void {
  const configDir = dirname(getTuiConfig());
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Ensure the directory for KiloCode's main config file exists.
 */
export function ensureKiloCodeConfigDir(): void {
  const configDir = dirname(getConfigJson());
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}
