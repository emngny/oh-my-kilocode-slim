import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { crossSpawn } from '../utils/compat';

let cachedKiloCodePath: string | null = null;

function resolvePathCommand(command: string): string | null {
  try {
    const resolver = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(resolver, [command], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.status !== 0) {
      return null;
    }

    const resolved = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    return resolved ?? null;
  } catch {
    return null;
  }
}

function canExecute(command: string, args: string[]): boolean {
  try {
    const result = spawnSync(command, args, {
      stdio: 'ignore',
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function getKiloCodePaths(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';

  return [
    // PATH (try this first)
    'kilo',
    // User local installations (Linux & macOS)
    `${home}/.local/bin/kilo`,
    `${home}/.kilo/bin/kilo`,
    `${home}/bin/kilo`,
    // System-wide installations
    '/usr/local/bin/kilo',
    '/opt/kilo/bin/kilo',
    '/usr/bin/kilo',
    '/bin/kilo',
    // macOS specific
    '/Applications/KiloCode.app/Contents/MacOS/kilo',
    `${home}/Applications/KiloCode.app/Contents/MacOS/kilo`,
    // Homebrew (macOS & Linux)
    '/opt/homebrew/bin/kilo',
    '/home/linuxbrew/.linuxbrew/bin/kilo',
    `${home}/homebrew/bin/kilo`,
    // macOS user Library
    `${home}/Library/Application Support/kilo/bin/kilo`,
    // Snap (Linux)
    '/snap/bin/kilo',
    '/var/snap/kilo/current/bin/kilo',
    // Flatpak (Linux)
    '/var/lib/flatpak/exports/bin/ai.kilo.KiloCode',
    `${home}/.local/share/flatpak/exports/bin/ai.kilo.KiloCode`,
    // Nix (Linux/macOS)
    '/nix/store/kilo/bin/kilo',
    `${home}/.nix-profile/bin/kilo`,
    '/run/current-system/sw/bin/kilo',
    // Cargo (Rust toolchain)
    `${home}/.cargo/bin/kilo`,
    // npm/npx global
    `${home}/.npm-global/bin/kilo`,
    '/usr/local/lib/node_modules/kilo/bin/kilo',
    // Yarn global
    `${home}/.yarn/bin/kilo`,
    // PNPM
    `${home}/.pnpm-global/bin/kilo`,
  ];
}

export function resolveKiloCodePath(): string {
  if (cachedKiloCodePath) {
    return cachedKiloCodePath;
  }

  const pathKiloCodePath = resolvePathCommand('kilo');
  if (pathKiloCodePath) {
    cachedKiloCodePath = pathKiloCodePath;
    return pathKiloCodePath;
  }

  const paths = getKiloCodePaths();

  for (const kiloPath of paths) {
    if (kiloPath === 'kilo') continue;
    try {
      const stat = statSync(kiloPath);
      if (stat.isFile()) {
        cachedKiloCodePath = kiloPath;
        return kiloPath;
      }
    } catch {
      // Try next path
    }
  }

  // Fallback to 'kilo' and hope it's in PATH
  return 'kilo';
}

export async function isKiloCodeInstalled(): Promise<boolean> {
  const pathKiloCodePath = resolvePathCommand('kilo');

  if (pathKiloCodePath && canExecute(pathKiloCodePath, ['--version'])) {
    cachedKiloCodePath = pathKiloCodePath;
    return true;
  }

  const paths = getKiloCodePaths();

  for (const kiloPath of paths) {
    if (kiloPath === 'kilo') continue;
    try {
      const proc = crossSpawn([kiloPath, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;
      if (proc.exitCode === 0) {
        cachedKiloCodePath = kiloPath;
        return true;
      }
    } catch {
      // Try next path
    }
  }
  return false;
}

export async function isTmuxInstalled(): Promise<boolean> {
  try {
    const proc = crossSpawn(['tmux', '-V'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getKiloCodeVersion(): Promise<string | null> {
  const kiloPath = resolveKiloCodePath();
  try {
    const proc = crossSpawn([kiloPath, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const outputPromise = proc.stdout();
    await proc.exited;
    if (proc.exitCode === 0) {
      return (await outputPromise).trim();
    }
  } catch {
    // Failed
  }
  return null;
}

export function getKiloCodePath(): string | null {
  const path = resolveKiloCodePath();
  return path === 'kilo' ? null : path;
}

export async function fetchLatestVersion(
  packageName: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
    if (!res.ok) return null;
    const data = (await res.json()) as { version: string };
    return data.version;
  } catch {
    return null;
  }
}
