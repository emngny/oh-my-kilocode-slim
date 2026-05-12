#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.0.0';
export const STATE_DIR = '.slim';
export const CLONEDEPS_DIR = 'clonedeps';
export const REPOS_DIR = 'repos';
export const STATE_FILE = 'clonedeps.json';
export const MAX_DEPENDENCIES = 5;
export const GITIGNORE_BEGIN = '# BEGIN oh-my-opencode-slim clonedeps';
export const GITIGNORE_END = '# END oh-my-opencode-slim clonedeps';
export const CLONE_TIMEOUT_MS = 120_000;

const UNSAFE_BRANCH_REFS = new Set([
  'main',
  'master',
  'develop',
  'dev',
  'next',
]);
const NPM_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

export function safePackagePathName(packageName) {
  if (typeof packageName !== 'string' || packageName.trim() === '') {
    throw new ValidationError('Dependency name must be a non-empty string');
  }

  if (
    packageName.includes('..') ||
    packageName.includes('\\') ||
    path.isAbsolute(packageName)
  ) {
    throw new ValidationError(`Unsafe dependency name: ${packageName}`);
  }

  if (!NPM_PACKAGE_NAME.test(packageName)) {
    throw new ValidationError(`Invalid npm package name: ${packageName}`);
  }

  return packageName.replaceAll('/', '__').replace(/[^@a-zA-Z0-9._-]/g, '_');
}

export function isSafeHttpsRepoUrl(repoUrl) {
  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.search || parsed.hash) return false;
    if (!['github.com', 'gitlab.com'].includes(parsed.hostname)) return false;
    if (parsed.pathname.includes('..')) return false;
    return /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
}

export function isPinnedRef(ref) {
  if (typeof ref !== 'string' || ref.trim() === '') return false;
  if (UNSAFE_BRANCH_REFS.has(ref)) return false;
  if (ref.includes('..')) return false;
  if (/^[a-f0-9]{40}$/i.test(ref)) return true;
  if (/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9._-]+)?$/.test(ref)) return true;
  return /^refs\/tags\/[A-Za-z0-9._/-]+$/.test(ref);
}

function assertSafeRelativePath(value, fieldName) {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (
    value.includes('..') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    path.isAbsolute(value)
  ) {
    throw new ValidationError(`${fieldName} must be a safe relative path`);
  }
}

export function validatePlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Plan must be an object');
  }
  if (input.version !== VERSION) {
    throw new ValidationError(`Plan version must be ${VERSION}`);
  }
  if (!Array.isArray(input.dependencies)) {
    throw new ValidationError('Plan dependencies must be an array');
  }
  if (input.dependencies.length > MAX_DEPENDENCIES) {
    throw new ValidationError(
      `Plan cannot include more than ${MAX_DEPENDENCIES} dependencies`,
    );
  }

  return {
    version: VERSION,
    dependencies: input.dependencies.map((dep, index) => {
      if (!dep || typeof dep !== 'object' || Array.isArray(dep)) {
        throw new ValidationError(`Dependency ${index} must be an object`);
      }
      if (dep.ecosystem !== 'npm') {
        throw new ValidationError(`Dependency ${index} must use npm ecosystem`);
      }
      if (typeof dep.name !== 'string' || dep.name.trim() === '') {
        throw new ValidationError(`Dependency ${index} needs a name`);
      }
      safePackagePathName(dep.name);
      if (!isSafeHttpsRepoUrl(dep.repoUrl)) {
        throw new ValidationError(
          `Dependency ${dep.name} has unsafe or unsupported repoUrl`,
        );
      }
      if (!isPinnedRef(dep.ref)) {
        throw new ValidationError(
          `Dependency ${dep.name} must use a pinned tag or commit ref`,
        );
      }
      if ('path' in dep || 'outputPath' in dep) {
        throw new ValidationError(
          `Dependency ${dep.name} must not provide output paths`,
        );
      }
      assertSafeRelativePath(dep.packagePath, 'packagePath');

      return {
        ecosystem: 'npm',
        name: dep.name,
        versionRange:
          typeof dep.versionRange === 'string' ? dep.versionRange : undefined,
        resolvedVersion:
          typeof dep.resolvedVersion === 'string'
            ? dep.resolvedVersion
            : undefined,
        repoUrl: dep.repoUrl,
        ref: dep.ref,
        packagePath: dep.packagePath,
        reason: typeof dep.reason === 'string' ? dep.reason : undefined,
      };
    }),
  };
}

export function upsertMarkerBlock(content, lines) {
  const block = [GITIGNORE_BEGIN, ...lines, GITIGNORE_END].join('\n');
  const pattern = new RegExp(
    `${escapeRegExp(GITIGNORE_BEGIN)}[\\s\\S]*?${escapeRegExp(GITIGNORE_END)}`,
  );
  const trimmed = content.replace(/\s+$/u, '');

  if (pattern.test(content)) {
    return `${content.replace(pattern, block).replace(/\s+$/u, '')}\n`;
  }
  return `${trimmed}${trimmed ? '\n\n' : ''}${block}\n`;
}

export function removeMarkerBlock(content) {
  const pattern = new RegExp(
    `\n?${escapeRegExp(GITIGNORE_BEGIN)}[\\s\\S]*?${escapeRegExp(GITIGNORE_END)}\n?`,
  );
  return content
    .replace(pattern, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readTextIfExists(filePath) {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`);
}

export function updateIgnoreFiles(root) {
  const gitignorePath = path.join(root, '.gitignore');
  const ignorePath = path.join(root, '.ignore');
  const gitignoreLines = ['.slim/clonedeps.json', '.slim/clonedeps/repos/'];
  const ignoreLines = [
    '!.slim/',
    '!.slim/clonedeps.json',
    '!.slim/clonedeps/',
    '!.slim/clonedeps/repos/',
    '!.slim/clonedeps/repos/**',
    '.slim/clonedeps/repos/**/.git/',
    '.slim/clonedeps/repos/**/.git/**',
  ];

  writeText(
    gitignorePath,
    upsertMarkerBlock(readTextIfExists(gitignorePath), gitignoreLines),
  );
  writeText(
    ignorePath,
    upsertMarkerBlock(readTextIfExists(ignorePath), ignoreLines),
  );
}

export function removeIgnoreBlocks(root) {
  for (const fileName of ['.gitignore', '.ignore']) {
    const filePath = path.join(root, fileName);
    if (!existsSync(filePath)) continue;
    writeText(filePath, removeMarkerBlock(readFileSync(filePath, 'utf8')));
  }
}

export function clonePathForDependency(root, dependency) {
  const version = dependency.resolvedVersion || dependency.ref;
  const safeName = safePackagePathName(dependency.name);
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(
    root,
    STATE_DIR,
    CLONEDEPS_DIR,
    REPOS_DIR,
    dependency.ecosystem,
    safeName,
    safeVersion,
  );
}

function statePath(root) {
  return path.join(root, STATE_DIR, STATE_FILE);
}

export function loadState(root) {
  const filePath = statePath(root);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function saveState(root, dependencies) {
  mkdirSync(path.join(root, STATE_DIR), { recursive: true });
  const state = {
    version: VERSION,
    root: '.',
    updatedAt: new Date().toISOString(),
    dependencies,
  };
  writeFileSync(statePath(root), `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

export function scanProject(root) {
  const packageJsonPath = path.join(root, 'package.json');
  const manifests = [];
  const lockfiles = [
    'bun.lock',
    'bun.lockb',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ].filter((fileName) => existsSync(path.join(root, fileName)));

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    manifests.push({
      type: 'npm',
      path: 'package.json',
      name: packageJson.name,
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
      optionalDependencies: packageJson.optionalDependencies ?? {},
      peerDependencies: packageJson.peerDependencies ?? {},
    });
  }

  return {
    version: VERSION,
    root: '.',
    manifests,
    lockfiles,
  };
}

function runGit(args, cwd, timeout = CLONE_TIMEOUT_MS) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(
      `git ${args.join(' ')} failed${detail ? `\n${detail}` : ''}`,
    );
  }
  return result.stdout.trim();
}

export function verifyRemoteRef(repoUrl, ref) {
  try {
    runGit(['ls-remote', '--exit-code', repoUrl, ref], process.cwd(), 30_000);
    return 'exact';
  } catch {
    return 'unverified';
  }
}

export function cloneDependency(root, dependency) {
  const targetPath = clonePathForDependency(root, dependency);
  if (existsSync(targetPath)) {
    return { path: targetPath, status: 'exists-unverified' };
  }

  const parentDir = path.dirname(targetPath);
  mkdirSync(parentDir, { recursive: true });
  const tempDir = mkdtempSync(path.join(parentDir, '.tmp-'));

  try {
    runGit(['init', tempDir], root);
    runGit(['remote', 'add', 'origin', dependency.repoUrl], tempDir);
    runGit(
      ['fetch', '--depth', '1', '--no-tags', 'origin', dependency.ref],
      tempDir,
    );
    runGit(['checkout', '--detach', 'FETCH_HEAD'], tempDir);
    renameSync(tempDir, targetPath);
    return { path: targetPath, status: 'cloned' };
  } catch (error) {
    rmSync(tempDir, { force: true, recursive: true });
    throw error;
  }
}

export function sync(root, plan) {
  return syncWithOperations(root, plan);
}

export function syncWithOperations(root, plan, operations = {}) {
  const ops = {
    cloneDependency,
    saveState,
    updateIgnoreFiles,
    verifyRemoteRef,
    ...operations,
  };
  const validated = validatePlan(plan);
  const dependencies = [];

  if (validated.dependencies.length === 0) {
    return ops.saveState(root, dependencies);
  }

  ops.updateIgnoreFiles(root);

  try {
    for (const dependency of validated.dependencies) {
      const refStatus = ops.verifyRemoteRef(dependency.repoUrl, dependency.ref);
      const result = ops.cloneDependency(root, dependency);
      dependencies.push({
        ...dependency,
        path: normalizePath(path.relative(root, result.path)),
        refStatus,
        status: result.status,
      });
      ops.saveState(root, dependencies);
    }
  } catch (error) {
    if (dependencies.length > 0) {
      try {
        ops.saveState(root, dependencies);
      } catch {
        // Preserve the original clone/fetch error for the caller.
      }
    }
    throw error;
  }

  return ops.saveState(root, dependencies);
}

export function clean(root) {
  rmSync(path.join(root, STATE_DIR, CLONEDEPS_DIR), {
    force: true,
    recursive: true,
  });
  rmSync(statePath(root), { force: true });
  removeIgnoreBlocks(root);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command, root: '.', plan: undefined };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--root') args.root = rest[++index];
    else if (value === '--plan') args.plan = rest[++index];
    else throw new ValidationError(`Unknown argument: ${value}`);
  }
  return args;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);

  if (!args.command || args.command === 'help') {
    console.log('Usage: clonedeps.mjs <scan|sync|status|clean> --root .');
    return;
  }

  if (args.command === 'scan') {
    printJson(scanProject(root));
    return;
  }
  if (args.command === 'status') {
    printJson(loadState(root) ?? { version: VERSION, dependencies: [] });
    return;
  }
  if (args.command === 'clean') {
    clean(root);
    printJson({ cleaned: true });
    return;
  }
  if (args.command === 'sync') {
    if (!args.plan) throw new ValidationError('sync requires --plan');
    const plan = JSON.parse(readFileSync(path.resolve(args.plan), 'utf8'));
    printJson(sync(root, plan));
    return;
  }

  throw new ValidationError(`Unknown command: ${args.command}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
