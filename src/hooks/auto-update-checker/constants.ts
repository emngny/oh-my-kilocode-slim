import * as os from 'node:os';
import * as path from 'node:path';
import { getKiloCodeConfigPaths } from '../../cli/config-manager';

export const PACKAGE_NAME = '@emngny/oh-my-kilocode-slim';
export const NPM_REGISTRY_URL = `https://registry.npmjs.org/-/package/${PACKAGE_NAME}/dist-tags`;
export const NPM_PACKAGE_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`;
export const NPM_FETCH_TIMEOUT = 5000;

function getCacheDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'kilo');
  }
  return path.join(os.homedir(), '.cache', 'kilo');
}

/** The directory used by KiloCode to cache node_modules for plugins. */
export const CACHE_DIR = getCacheDir();

/** Path to this plugin's package.json within the KiloCode cache. */
export const INSTALLED_PACKAGE_JSON = path.join(
  CACHE_DIR,
  'node_modules',
  PACKAGE_NAME,
  'package.json',
);

const configPaths = getKiloCodeConfigPaths();

/** Primary KiloCode configuration file path (standard JSON). */
export const USER_KILOCODE_CONFIG = configPaths[0];

/** Alternative KiloCode configuration file path (JSON with Comments). */
export const USER_KILOCODE_CONFIG_JSONC = configPaths[1];
