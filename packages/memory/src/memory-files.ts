import { stat } from '@tauri-apps/plugin-fs';
import { bucketForRelativePath, type MemoryEntryBucket } from './memory-categories.js';
import { getActiveMemoryPath } from './memory-paths.js';
import { relativeVaultPath, walkMarkdownFiles } from './vault-utils.js';

export type MemoryMarkdownFile = {
  absolutePath: string;
  relativePath: string;
  name: string;
  modifiedAt: string;
};

type IndexedMemoryMarkdownFile = MemoryMarkdownFile & {
  modifiedAtMs: number;
};

export type CategorisedMemoryFiles = {
  rootPath: string;
  buckets: Record<MemoryEntryBucket, MemoryMarkdownFile[]>;
};

const toIndexedFile = async (
  absolutePath: string,
  rootPath: string,
): Promise<IndexedMemoryMarkdownFile> => {
  const fileInfo = await stat(absolutePath);
  const relativePath = relativeVaultPath(rootPath, absolutePath);
  const modifiedAtMs = fileInfo.mtime?.getTime() ?? 0;

  return {
    absolutePath,
    relativePath,
    name: relativePath.split('/').at(-1) ?? relativePath,
    modifiedAt: fileInfo.mtime?.toISOString() ?? new Date(modifiedAtMs).toISOString(),
    modifiedAtMs,
  };
};

const stripIndex = (file: IndexedMemoryMarkdownFile): MemoryMarkdownFile => {
  const { modifiedAtMs: _modifiedAtMs, ...rest } = file;
  return rest;
};

const sortNewestFirst = (left: IndexedMemoryMarkdownFile, right: IndexedMemoryMarkdownFile): number => {
  return right.modifiedAtMs - left.modifiedAtMs || left.relativePath.localeCompare(right.relativePath);
};

export const listMemoryMarkdownFiles = async (
  userId: string,
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<MemoryMarkdownFile[]> => {
  const activeMemoryPath = await getActiveMemoryPath(userId, runtimePlatform);
  const markdownFiles = await walkMarkdownFiles(activeMemoryPath);
  const indexedFiles = await Promise.all(
    markdownFiles.map((absolutePath) => toIndexedFile(absolutePath, activeMemoryPath)),
  );

  return indexedFiles.sort(sortNewestFirst).map(stripIndex);
};

const emptyBuckets = (): Record<MemoryEntryBucket, IndexedMemoryMarkdownFile[]> => {
  const buckets: Record<MemoryEntryBucket, IndexedMemoryMarkdownFile[]> = {
    pending: [],
    people: [],
    'active-work': [],
    capabilities: [],
    preferences: [],
    organization: [],
  };
  return buckets;
};

export const listCategorisedMemoryFiles = async (
  userId: string,
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<CategorisedMemoryFiles> => {
  const activeMemoryPath = await getActiveMemoryPath(userId, runtimePlatform);
  const markdownFiles = await walkMarkdownFiles(activeMemoryPath);
  const indexedFiles = await Promise.all(
    markdownFiles.map((absolutePath) => toIndexedFile(absolutePath, activeMemoryPath)),
  );

  const buckets = emptyBuckets();

  for (const file of indexedFiles) {
    const bucket = bucketForRelativePath(file.relativePath);
    if (bucket === null) {
      continue;
    }
    buckets[bucket].push(file);
  }

  const sortedBuckets = Object.fromEntries(
    (Object.entries(buckets) as Array<[MemoryEntryBucket, IndexedMemoryMarkdownFile[]]>).map(
      ([bucket, files]) => [bucket, files.sort(sortNewestFirst).map(stripIndex)] as const,
    ),
  ) as Record<MemoryEntryBucket, MemoryMarkdownFile[]>;

  return {
    rootPath: activeMemoryPath,
    buckets: sortedBuckets,
  };
};
