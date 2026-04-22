import { dataDir, join } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir, readDir, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { createSettingsStore, type SettingsStore } from './settings-store.js';
import { emitMemoryPathChanged } from './events.js';
export { subscribeMemoryPathChanged } from './events.js';
export type { MemoryPathChangedDetail } from './events.js';

const WINDOWS_ROAMING_APP_DATA_SUFFIX = /\/AppData\/Roaming\/?$/iu;
const MACOS_APPLICATION_SUPPORT_SUFFIX = /\/Library\/Application Support\/?$/u;

export type MemoryRootPlatform = 'linux' | 'macos' | 'windows';
export type MemoryRootSetting = {
  path: string;
};

export type MemoryRootMoveProgress = {
  copiedFiles: number;
  totalFiles: number;
  currentPath: string | null;
};

type RelativeMemoryTree = {
  directories: string[];
  files: string[];
};

type ActiveMemoryPathState = {
  root: string;
  path: string;
  userId: string;
};

const normalizeDirectoryForDetection = (directory: string): string => {
  return directory.replace(/\\/gu, '/');
};

const MEMORY_ROOT_SETTING_KEY = 'memory_root';
const MEMORY_ROOT_PROBE_FILE_PREFIX = '.tinker-memory-root-probe';
let activeMemoryPathState: ActiveMemoryPathState | null = null;

const createMemorySettingsStore = (): SettingsStore => {
  return createSettingsStore();
};

const isMemoryRootSetting = (value: unknown): value is MemoryRootSetting => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof value.path === 'string' &&
    value.path.trim().length > 0
  );
};

const joinRelativePath = (prefix: string, child: string): string => {
  return prefix.length === 0 ? child : `${prefix}/${child}`;
};

const normalizePathForNestCheck = (path: string): string => {
  const forwardSlashed = path.replace(/\\/gu, '/');
  return forwardSlashed.replace(/\/+$/u, '');
};

const isSamePath = (a: string, b: string): boolean => {
  return normalizePathForNestCheck(a) === normalizePathForNestCheck(b);
};

const isPathNestedUnder = (candidate: string, ancestor: string): boolean => {
  const normalizedCandidate = normalizePathForNestCheck(candidate);
  const normalizedAncestor = normalizePathForNestCheck(ancestor);
  if (normalizedAncestor.length === 0) {
    return false;
  }
  return normalizedCandidate.startsWith(`${normalizedAncestor}/`);
};

const listMemoryTree = async (rootPath: string, relativeDirectory = ''): Promise<RelativeMemoryTree> => {
  const absoluteDirectory = relativeDirectory.length === 0 ? rootPath : await join(rootPath, relativeDirectory);
  const entries = await readDir(absoluteDirectory);
  const directories: string[] = [];
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = joinRelativePath(relativeDirectory, entry.name);

    if (entry.isDirectory) {
      directories.push(relativePath);
      const nested = await listMemoryTree(rootPath, relativePath);
      directories.push(...nested.directories);
      files.push(...nested.files);
      continue;
    }

    if (entry.isFile) {
      files.push(relativePath);
    }
  }

  return { directories, files };
};

const removeDirectoryContents = async (rootPath: string): Promise<void> => {
  if (!(await exists(rootPath))) {
    return;
  }

  const entries = await readDir(rootPath);
  await Promise.all(entries.map(async (entry) => remove(await join(rootPath, entry.name), { recursive: true })));
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

export const getMemoryRoot = async (
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<string> => {
  const settingsStore = createMemorySettingsStore();
  const setting = await settingsStore.get<MemoryRootSetting>(MEMORY_ROOT_SETTING_KEY);

  if (setting && isMemoryRootSetting(setting.value)) {
    await mkdir(setting.value.path, { recursive: true });
    return setting.value.path;
  }

  const memoryRoot = await ensureDefaultMemoryRoot(runtimePlatform);
  await settingsStore.set({
    key: MEMORY_ROOT_SETTING_KEY,
    value: { path: memoryRoot },
    updatedAt: new Date().toISOString(),
  });

  return memoryRoot;
};

export const getActiveMemoryPath = async (
  userId: string,
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<string> => {
  const normalizedUserId = userId.trim();
  if (normalizedUserId.length === 0) {
    throw new Error('Cannot resolve active memory path without a user id.');
  }

  const memoryRoot = await getMemoryRoot(runtimePlatform);
  const activeMemoryPath = await join(memoryRoot, normalizedUserId);
  await mkdir(activeMemoryPath, { recursive: true });
  return activeMemoryPath;
};

export const syncActiveMemoryPath = async (
  userId: string,
  options?: {
    emit?: boolean;
    runtimePlatform?: string;
  },
): Promise<string> => {
  const normalizedUserId = userId.trim();
  if (normalizedUserId.length === 0) {
    throw new Error('Cannot resolve active memory path without a user id.');
  }

  const memoryRoot = await getMemoryRoot(options?.runtimePlatform);
  const activeMemoryPath = await join(memoryRoot, normalizedUserId);
  await mkdir(activeMemoryPath, { recursive: true });

  const previousState = activeMemoryPathState;
  const changed =
    previousState === null ||
    !isSamePath(previousState.root, memoryRoot) ||
    !isSamePath(previousState.path, activeMemoryPath) ||
    previousState.userId !== normalizedUserId;

  activeMemoryPathState = {
    root: memoryRoot,
    path: activeMemoryPath,
    userId: normalizedUserId,
  };

  if (options?.emit === false || !changed) {
    return activeMemoryPath;
  }

  emitMemoryPathChanged({
    reason: 'user-changed',
    previousRoot: previousState?.root ?? memoryRoot,
    nextRoot: memoryRoot,
    previousPath: previousState?.path ?? null,
    nextPath: activeMemoryPath,
    previousUserId: previousState?.userId ?? null,
    nextUserId: normalizedUserId,
  });

  return activeMemoryPath;
};

export const validateMemoryRootWritable = async (memoryRoot: string): Promise<void> => {
  const normalizedRoot = memoryRoot.trim();
  if (normalizedRoot.length === 0) {
    throw new Error('Memory folder cannot be empty.');
  }

  await mkdir(normalizedRoot, { recursive: true });

  const probePath = await join(
    normalizedRoot,
    `${MEMORY_ROOT_PROBE_FILE_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
  );

  try {
    await writeTextFile(probePath, 'tinker-memory-root-probe');
  } finally {
    if (await exists(probePath)) {
      await remove(probePath);
    }
  }
};

export const moveMemoryRoot = async (
  nextRoot: string,
  options?: {
    onProgress?: (progress: MemoryRootMoveProgress) => void;
    runtimePlatform?: string;
  },
): Promise<string> => {
  const normalizedNextRoot = nextRoot.trim();
  if (normalizedNextRoot.length === 0) {
    throw new Error('Memory folder cannot be empty.');
  }

  const currentRoot = await getMemoryRoot(options?.runtimePlatform);
  if (isSamePath(currentRoot, normalizedNextRoot)) {
    return currentRoot;
  }

  if (isPathNestedUnder(normalizedNextRoot, currentRoot)) {
    throw new Error('New memory folder cannot be inside current memory folder.');
  }
  if (isPathNestedUnder(currentRoot, normalizedNextRoot)) {
    throw new Error('New memory folder cannot contain current memory folder.');
  }

  const destinationAlreadyExists = await exists(normalizedNextRoot);
  if (destinationAlreadyExists) {
    const existingEntries = await readDir(normalizedNextRoot);
    if (existingEntries.length > 0) {
      throw new Error('Pick an empty folder for the new memory location.');
    }
  } else {
    await mkdir(normalizedNextRoot, { recursive: true });
  }

  const tree = await listMemoryTree(currentRoot);
  const totalFiles = tree.files.length;
  let copiedFiles = 0;

  options?.onProgress?.({ copiedFiles, totalFiles, currentPath: null });

  try {
    for (const directory of tree.directories) {
      await mkdir(await join(normalizedNextRoot, directory), { recursive: true });
    }

    for (const relativeFile of tree.files) {
      await copyFile(await join(currentRoot, relativeFile), await join(normalizedNextRoot, relativeFile));
      copiedFiles += 1;
      options?.onProgress?.({ copiedFiles, totalFiles, currentPath: relativeFile });
    }

    const settingsStore = createMemorySettingsStore();
    await settingsStore.set({
      key: MEMORY_ROOT_SETTING_KEY,
      value: { path: normalizedNextRoot },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    await removeDirectoryContents(normalizedNextRoot);

    if (!destinationAlreadyExists) {
      await remove(normalizedNextRoot, { recursive: true }).catch(() => undefined);
    }

    throw error;
  }

  await remove(currentRoot, { recursive: true }).catch(() => undefined);

  const previousState = activeMemoryPathState;
  if (previousState) {
    const nextActivePath = await join(normalizedNextRoot, previousState.userId);
    activeMemoryPathState = {
      root: normalizedNextRoot,
      path: nextActivePath,
      userId: previousState.userId,
    };
  }

  emitMemoryPathChanged({
    reason: 'root-changed',
    previousRoot: currentRoot,
    nextRoot: normalizedNextRoot,
    previousPath: previousState?.path ?? null,
    nextPath: activeMemoryPathState?.path ?? null,
    previousUserId: previousState?.userId ?? null,
    nextUserId: activeMemoryPathState?.userId ?? null,
  });
  return normalizedNextRoot;
};
