/// <reference types="bun-types" />
import { describe, expect, mock, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';

// Mock logger to avoid noise
mock.module('../../utils/logger', () => ({
  log: mock(() => {}),
}));

mock.module('../../cli/config-manager', () => ({
  stripJsonComments: (s: string) => s,
  getKiloCodeConfigPaths: () => [
    '/mock/config/kilo.json',
    '/mock/config/kilo.jsonc',
  ],
}));

// Cache buster for dynamic imports
let importCounter = 0;

describe('auto-update-checker/cache', () => {
  describe('resolveInstallContext', () => {
    test('detects KiloCode packages install root from runtime package path', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockImplementation(
        (p: fs.PathLike) =>
          String(p).replaceAll('\\', '/') ===
          '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/package.json',
      );
      const { resolveInstallContext } = await import(
        `./cache?test=${importCounter++}`
      );

      const context = resolveInstallContext(
        '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/node_modules/@emngny/oh-my-kilocode-slim/package.json',
      );

      expect(
        context
          ? {
              installDir: context.installDir.replaceAll('\\', '/'),
              packageJsonPath: context.packageJsonPath.replaceAll('\\', '/'),
            }
          : null,
      ).toEqual({
        installDir:
          '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest',
        packageJsonPath:
          '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/package.json',
      });

      existsSpy.mockRestore();
    });

    test('does not fall back to legacy cache when runtime path is active but wrapper root is invalid', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockImplementation(() => false);
      const { resolveInstallContext } = await import(
        `./cache?test=${importCounter++}`
      );

      const context = resolveInstallContext(
        '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/node_modules/@emngny/oh-my-kilocode-slim/package.json',
      );

      expect(context).toBeNull();

      existsSpy.mockRestore();
    });
  });

  describe('preparePackageUpdate', () => {
    test('returns null when no install context is available', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockReturnValue(false);
      const { preparePackageUpdate } = await import(
        `./cache?test=${importCounter++}`
      );

      const result = preparePackageUpdate('1.0.1');
      expect(result).toBeNull();

      existsSpy.mockRestore();
    });

    test('updates packages wrapper dependency and removes installed package', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockImplementation(
        (p: fs.PathLike) =>
          String(p).replaceAll('\\', '/') ===
            '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/package.json' ||
          String(p).replaceAll('\\', '/') ===
            '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/node_modules/@emngny/oh-my-kilocode-slim',
      );
      const readSpy = spyOn(fs, 'readFileSync').mockImplementation(((
        p: fs.PathOrFileDescriptor,
      ) => {
        if (
          String(p).replaceAll('\\', '/') ===
          '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/package.json'
        ) {
          return JSON.stringify({
            dependencies: {
              '@emngny/oh-my-kilocode-slim': '0.9.1',
            },
          });
        }
        return '';
      }) as any);
      const writtenData: string[] = [];
      const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(
        (_path: fs.PathOrFileDescriptor, data: any) => {
          writtenData.push(data as string);
        },
      );
      const rmSyncSpy = spyOn(fs, 'rmSync').mockReturnValue(undefined);
      const { preparePackageUpdate } = await import(
        `./cache?test=${importCounter++}`
      );

      const result = preparePackageUpdate(
        '0.9.11',
        '@emngny/oh-my-kilocode-slim',
        '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/node_modules/@emngny/oh-my-kilocode-slim/package.json',
      );

      expect(result?.replaceAll('\\', '/')).toBe(
        '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest',
      );
      expect(String(rmSyncSpy.mock.calls[0][0]).replaceAll('\\', '/')).toBe(
        '/home/user/.cache/kilo/packages/@emngny/oh-my-kilocode-slim@latest/node_modules/@emngny/oh-my-kilocode-slim',
      );
      expect(writtenData.length).toBeGreaterThan(0);
      expect(JSON.parse(writtenData[0])).toEqual({
        dependencies: {
          '@emngny/oh-my-kilocode-slim': '0.9.11',
        },
      });

      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      rmSyncSpy.mockRestore();
    });

    test('keeps working when dependency is already on target version', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockImplementation(
        (p: fs.PathLike) => {
          const normalized = String(p).replaceAll('\\', '/');
          return (
            normalized.endsWith('kilo/package.json') ||
            normalized.endsWith('kilo/node_modules/@emngny/oh-my-kilocode-slim')
          );
        },
      );
      const readSpy = spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          dependencies: {
            '@emngny/oh-my-kilocode-slim': '1.0.1',
          },
        }),
      );
      const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const rmSyncSpy = spyOn(fs, 'rmSync').mockReturnValue(undefined);
      const { preparePackageUpdate } = await import(
        `./cache?test=${importCounter++}`
      );

      const result = preparePackageUpdate(
        '1.0.1',
        '@emngny/oh-my-kilocode-slim',
        null,
      );

      expect(result?.replaceAll('\\', '/').endsWith('kilo')).toBe(true);
      expect(writeSpy).not.toHaveBeenCalled();
      expect(rmSyncSpy).toHaveBeenCalled();

      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      rmSyncSpy.mockRestore();
    });
  });
});
