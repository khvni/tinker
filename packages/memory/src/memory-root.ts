import { dataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';

const WINDOWS_ROAMING_APP_DATA_SUFFIX = /\/AppData\/Roaming\/?$/iu;
const MACOS_APPLICATION_SUPPORT_SUFFIX = /\/Library\/Application Support\/?$/u;

export type MemoryRootPlatform = 'linux' | 'macos' | 'windows';

const normalizeDirectoryForDetection = (directory: string): string => {
  return directory.replace(/\\/gu, '/');
};

export const detectMemoryRootPlatform = (dataDirectory: string): MemoryRootPlatform => {
  const normalizedDirectory = normalizeDirectoryForDetection(dataDirectory);

  if (WINDOWS_ROAMING_APP_DATA_SUFFIX.test(normalizedDirectory)) {
    return 'windows';
  }

  if (MACOS_APPLICATION_SUPPORT_SUFFIX.test(normalizedDirectory)) {
    return 'macos';
  }

  return 'linux';
};

export const defaultMemoryRootSegments = (dataDirectory: string): [string, string] => {
  return detectMemoryRootPlatform(dataDirectory) === 'linux' ? ['tinker', 'memory'] : ['Tinker', 'memory'];
};

export const resolveDefaultMemoryRoot = async (): Promise<string> => {
  const baseDataDirectory = await dataDir();
  const [applicationDirectory, memoryDirectory] = defaultMemoryRootSegments(baseDataDirectory);

  return join(baseDataDirectory, applicationDirectory, memoryDirectory);
};

export const ensureDefaultMemoryRoot = async (): Promise<string> => {
  const memoryRoot = await resolveDefaultMemoryRoot();

  if (!(await exists(memoryRoot))) {
    await mkdir(memoryRoot, { recursive: true });
  }

  return memoryRoot;
};
