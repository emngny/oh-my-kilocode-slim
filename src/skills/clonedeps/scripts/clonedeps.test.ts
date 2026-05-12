import { afterEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  clean,
  clonePathForDependency,
  isPinnedRef,
  isSafeHttpsRepoUrl,
  loadState,
  safePackagePathName,
  scanProject,
  saveState,
  syncWithOperations,
  updateIgnoreFiles,
  validatePlan,
  ValidationError,
} = await import('./clonedeps.mjs');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'clonedeps-'));
  tempDirs.push(dir);
  return dir;
}

function validPlan(overrides = {}) {
  return {
    version: '1.0.0',
    dependencies: [
      {
        ecosystem: 'npm',
        name: '@opencode-ai/sdk',
        versionRange: '^1.3.17',
        resolvedVersion: '1.3.17',
        repoUrl: 'https://github.com/sst/opencode.git',
        ref: 'v1.3.17',
        packagePath: 'packages/sdk/js',
        reason: 'Core runtime SDK',
        ...overrides,
      },
    ],
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe('clonedeps path and URL helpers', () => {
  test('normalizes scoped package names', () => {
    expect(safePackagePathName('@scope/pkg')).toBe('@scope__pkg');
    expect(safePackagePathName('plain-package')).toBe('plain-package');
  });

  test('rejects unsafe package names', () => {
    expect(() => safePackagePathName('../pkg')).toThrow(ValidationError);
    expect(() => safePackagePathName('/pkg')).toThrow(ValidationError);
    expect(() => safePackagePathName('a/b/c')).toThrow(ValidationError);
  });

  test('accepts only safe HTTPS GitHub or GitLab repository URLs', () => {
    expect(isSafeHttpsRepoUrl('https://github.com/org/repo.git')).toBe(true);
    expect(isSafeHttpsRepoUrl('https://gitlab.com/org/repo')).toBe(true);
    expect(isSafeHttpsRepoUrl('git@github.com:org/repo.git')).toBe(false);
    expect(isSafeHttpsRepoUrl('file:///tmp/repo')).toBe(false);
    expect(isSafeHttpsRepoUrl('https://github.com/org/repo.git?x=1')).toBe(
      false,
    );
    expect(isSafeHttpsRepoUrl('https://token@github.com/org/repo.git')).toBe(
      false,
    );
  });

  test('recognizes pinned refs and rejects common branch refs', () => {
    expect(isPinnedRef('v1.2.3')).toBe(true);
    expect(isPinnedRef('1.2.3-beta.1')).toBe(true);
    expect(isPinnedRef('a'.repeat(40))).toBe(true);
    expect(isPinnedRef('refs/tags/v1.2.3')).toBe(true);
    expect(isPinnedRef('main')).toBe(false);
    expect(isPinnedRef('master')).toBe(false);
    expect(isPinnedRef('refs/heads/main')).toBe(false);
    expect(isPinnedRef('refs/tags/../bad')).toBe(false);
  });
});

describe('validatePlan', () => {
  test('accepts a valid npm plan', () => {
    expect(validatePlan(validPlan()).dependencies[0]?.name).toBe(
      '@opencode-ai/sdk',
    );
  });

  test('rejects unsupported ecosystems and unsafe URLs', () => {
    expect(() => validatePlan(validPlan({ ecosystem: 'python' }))).toThrow(
      ValidationError,
    );
    expect(() =>
      validatePlan(validPlan({ repoUrl: 'file:///tmp/repo' })),
    ).toThrow(ValidationError);
  });

  test('rejects unpinned refs and plan-provided output paths', () => {
    expect(() => validatePlan(validPlan({ ref: 'main' }))).toThrow(
      ValidationError,
    );
    expect(() => validatePlan(validPlan({ path: '/tmp/evil' }))).toThrow(
      ValidationError,
    );
  });

  test('rejects too many dependencies', () => {
    const plan = {
      version: '1.0.0',
      dependencies: Array.from({ length: 6 }, (_, index) => ({
        ecosystem: 'npm',
        name: `pkg-${index}`,
        repoUrl: `https://github.com/org/repo-${index}.git`,
        ref: 'v1.0.0',
      })),
    };

    expect(() => validatePlan(plan)).toThrow(ValidationError);
  });
});

describe('state and ignore file management', () => {
  test('updates ignore files with idempotent marker blocks', () => {
    const root = createTempDir();
    writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');

    updateIgnoreFiles(root);
    updateIgnoreFiles(root);

    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    const ignore = readFileSync(path.join(root, '.ignore'), 'utf8');

    expect(
      gitignore.match(/BEGIN oh-my-opencode-slim clonedeps/g),
    ).toHaveLength(1);
    expect(gitignore).toContain('.slim/clonedeps/repos/');
    expect(ignore).toContain('!.slim/clonedeps/repos/**');
    expect(ignore).toContain('.slim/clonedeps/repos/**/.git/**');
  });

  test('saves, loads, and cleans local state', () => {
    const root = createTempDir();
    const dependency = validatePlan(validPlan()).dependencies[0];
    const clonePath = clonePathForDependency(root, dependency);
    mkdirSync(clonePath, { recursive: true });
    updateIgnoreFiles(root);

    saveState(root, [
      {
        ...dependency,
        path: '.slim/clonedeps/repos/npm/@opencode-ai__sdk/1.3.17',
        status: 'cloned',
      },
    ]);

    expect(loadState(root)?.dependencies).toHaveLength(1);

    clean(root);

    expect(loadState(root)).toBeNull();
    expect(existsSync(clonePath)).toBe(false);
    expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).not.toContain(
      'oh-my-opencode-slim clonedeps',
    );
  });

  test('sync saves partial state when a later clone fails', () => {
    const root = createTempDir();
    const plan = {
      version: '1.0.0',
      dependencies: [
        validPlan().dependencies[0],
        {
          ...validPlan({ name: 'zod' }).dependencies[0],
          resolvedVersion: '4.0.0',
          repoUrl: 'https://github.com/colinhacks/zod.git',
          ref: 'v4.0.0',
        },
      ],
    };
    let clones = 0;

    expect(() =>
      syncWithOperations(root, plan, {
        cloneDependency: (_root, dependency) => {
          clones += 1;
          if (clones === 2) throw new Error('clone failed');
          const clonePath = clonePathForDependency(root, dependency);
          mkdirSync(clonePath, { recursive: true });
          return { path: clonePath, status: 'cloned' };
        },
        saveState,
        updateIgnoreFiles,
        verifyRemoteRef: () => 'exact',
      }),
    ).toThrow('clone failed');

    expect(loadState(root)?.dependencies).toHaveLength(1);
    expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain(
      '.slim/clonedeps/repos/',
    );
  });

  test('sync preserves existing state when first clone fails', () => {
    const root = createTempDir();
    const dependency = validatePlan(validPlan()).dependencies[0];
    saveState(root, [
      {
        ...dependency,
        path: '.slim/clonedeps/repos/npm/@opencode-ai__sdk/1.3.17',
        status: 'cloned',
      },
    ]);

    expect(() =>
      syncWithOperations(root, validPlan(), {
        cloneDependency: () => {
          throw new Error('first clone failed');
        },
        saveState,
        updateIgnoreFiles,
        verifyRemoteRef: () => 'exact',
      }),
    ).toThrow('first clone failed');

    expect(loadState(root)?.dependencies).toHaveLength(1);
  });
});

describe('scanProject', () => {
  test('scans npm package metadata', () => {
    const root = createTempDir();
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'example',
        dependencies: { zod: '^4.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
    );
    writeFileSync(path.join(root, 'bun.lock'), '');

    const scan = scanProject(root);

    expect(scan.manifests[0]?.name).toBe('example');
    expect(scan.manifests[0]?.dependencies.zod).toBe('^4.0.0');
    expect(scan.lockfiles).toEqual(['bun.lock']);
  });
});
