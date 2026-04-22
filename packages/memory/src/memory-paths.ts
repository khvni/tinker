import { dataDir, join } from '@tauri-apps/api/path';
import { mkdir } from '@tauri-apps/plugin-fs';

const WINDOWS_ROAMING_APP_DATA_SUFFIX = /\/AppData\/Roaming\/?$/iu;
const MACOS_APPLICATION_SUPPORT_SUFFIX = /\/Library\/Application Support\/?$/u;

export type MemoryRootPlatform = 'linux' | 'macos' | 'windows';

const normalizeDirectoryForDetection = (directory: string): string => {
  return directory.replace(/\\/gu, '/');
};

const detectMemoryRootPlatformFromDirectory = (dataDirectory: string): MemoryRootPlatform => {
  const normalizedDirectory = normalizeDirectoryForDetection(dataDirectory);

  if (WINDOWS_ROAMING_APP_DATA_SUFFIX.test(normalizedDirectory)) {
    return 'windows';
  }

  if (MACOS_APPLICATION_SUPPORT_SUFFIX.test(normalizedDirectory)) {
    return 'macos';
  }

  return 'linux';
};

export const detectMemoryRootPlatform = (
  dataDirectory: string,
  runtimePlatform: string | undefined = globalThis.process?.platform,
): MemoryRootPlatform => {
  if (runtimePlatform === 'darwin') {
    return 'macos';
  }

  if (runtimePlatform === 'win32') {
    return 'windows';
  }

  if (runtimePlatform === 'linux') {
    return 'linux';
  }

  return detectMemoryRootPlatformFromDirectory(dataDirectory);
};

export const defaultMemoryRootSegments = (
  dataDirectory: string,
  runtimePlatform: string | undefined = globalThis.process?.platform,
): [string, string] => {
  return detectMemoryRootPlatform(dataDirectory, runtimePlatform) === 'linux'
    ? ['tinker', 'memory']
    : ['Tinker', 'memory'];
};

export const resolveDefaultMemoryRoot = async (
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<string> => {
  const baseDataDirectory = await dataDir();
  const [applicationDirectory, memoryDirectory] = defaultMemoryRootSegments(baseDataDirectory, runtimePlatform);

  return join(baseDataDirectory, applicationDirectory, memoryDirectory);
};

export const ensureDefaultMemoryRoot = async (
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<string> => {
  const memoryRoot = await resolveDefaultMemoryRoot(runtimePlatform);
  await mkdir(memoryRoot, { recursive: true });
  return memoryRoot;
};
