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
        (p: string) =>
          p.replace(/\\/g, '/') ===
          '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/package.json',
      );
      const { resolveInstallContext } = await import(
        `./cache?test=${importCounter++}`
      );

      const context = resolveInstallContext(
        '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/node_modules/oh-my-kilocode-slim/package.json',
      );

      expect(
        context
          ? {
              installDir: context.installDir.replace(/\\/g, '/'),
              packageJsonPath: context.packageJsonPath.replace(/\\/g, '/'),
            }
          : null,
      ).toEqual({
        installDir:
          '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest',
        packageJsonPath:
          '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/package.json',
      });

      existsSpy.mockRestore();
    });

    test('does not fall back to legacy cache when runtime path is active but wrapper root is invalid', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockImplementation(() => false);
      const { resolveInstallContext } = await import(
        `./cache?test=${importCounter++}`
      );

      const context = resolveInstallContext(
        '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/node_modules/oh-my-kilocode-slim/package.json',
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
        (p: string) =>
          p.replace(/\\/g, '/') ===
            '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/package.json' ||
          p.replace(/\\/g, '/') ===
            '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/node_modules/oh-my-kilocode-slim',
      );
      const readSpy = spyOn(fs, 'readFileSync').mockImplementation(
        (p: string) => {
          if (
            p.replace(/\\/g, '/') ===
            '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/package.json'
          ) {
            return JSON.stringify({
              dependencies: {
                'oh-my-kilocode-slim': '0.9.1',
              },
            });
          }
          return '';
        },
      );
      const writtenData: string[] = [];
      const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(
        (_path: string, data: string) => {
          writtenData.push(data);
        },
      );
      const rmSyncSpy = spyOn(fs, 'rmSync').mockReturnValue(undefined);
      const { preparePackageUpdate } = await import(
        `./cache?test=${importCounter++}`
      );

      const result = preparePackageUpdate(
        '0.9.11',
        'oh-my-kilocode-slim',
        '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/node_modules/oh-my-kilocode-slim/package.json',
      );

      expect(result?.replace(/\\/g, '/')).toBe(
        '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest',
      );
      expect(rmSyncSpy.mock.calls[0][0].replace(/\\/g, '/')).toBe(
        '/home/user/.cache/kilo/packages/oh-my-kilocode-slim@latest/node_modules/oh-my-kilocode-slim',
      );
      expect(writtenData.length).toBeGreaterThan(0);
      expect(JSON.parse(writtenData[0])).toEqual({
        dependencies: {
          'oh-my-kilocode-slim': '0.9.11',
        },
      });

      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      rmSyncSpy.mockRestore();
    });

    test('keeps working when dependency is already on target version', async () => {
      const existsSpy = spyOn(fs, 'existsSync').mockImplementation(
        (p: string) => {
          const normalized = p.replace(/\\/g, '/');
          return (
            normalized.endsWith('kilo/package.json') ||
            normalized.endsWith('kilo/node_modules/oh-my-kilocode-slim')
          );
        },
      );
      const readSpy = spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          dependencies: {
            'oh-my-kilocode-slim': '1.0.1',
          },
        }),
      );
      const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const rmSyncSpy = spyOn(fs, 'rmSync').mockReturnValue(undefined);
      const { preparePackageUpdate } = await import(
        `./cache?test=${importCounter++}`
      );

      const result = preparePackageUpdate('1.0.1', 'oh-my-kilocode-slim', null);

      expect(result?.replace(/\\/g, '/').endsWith('kilo')).toBe(true);
      expect(writeSpy).not.toHaveBeenCalled();
      expect(rmSyncSpy).toHaveBeenCalled();

      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      rmSyncSpy.mockRestore();
    });
  });
});
