import { readTextFile, stat } from '@tauri-apps/plugin-fs';
import {
  bucketForFrontmatter,
  bucketForRelativePath,
  type MemoryCategoryId,
  type MemoryEntryBucket,
} from './memory-categories.js';
import { getActiveMemoryPath } from './memory-paths.js';
import {
  deriveNoteTitle,
  parseFrontmatter,
  relativeVaultPath,
  walkMarkdownFiles,
} from './vault-utils.js';

export type MemoryMarkdownFile = {
  absolutePath: string;
  relativePath: string;
  name: string;
  title: string;
  modifiedAt: string;
  category: MemoryCategoryId | null;
  displayPath: string;
  changesPreview: string | null;
};

type IndexedMemoryMarkdownFile = MemoryMarkdownFile & {
  modifiedAtMs: number;
};

export type CategorisedMemoryFiles = {
  rootPath: string;
  buckets: Record<MemoryEntryBucket, MemoryMarkdownFile[]>;
};

const readFrontmatterString = (
  frontmatter: Record<string, unknown>,
  ...keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = frontmatter[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const readFileMetadata = async (
  absolutePath: string,
  relativePath: string,
): Promise<Pick<MemoryMarkdownFile, 'title' | 'category' | 'displayPath' | 'changesPreview'>> => {
  try {
    const text = await readTextFile(absolutePath);
    const { frontmatter, body } = parseFrontmatter(text);
    const pathBucket = bucketForRelativePath(relativePath);
    const category =
      bucketForFrontmatter(frontmatter) ?? (pathBucket && pathBucket !== 'pending' ? pathBucket : null);

    return {
      title: deriveNoteTitle(relativePath, frontmatter, body),
      category,
      displayPath: readFrontmatterString(frontmatter, 'display_path', 'displayPath') ?? absolutePath,
      changesPreview:
        readFrontmatterString(frontmatter, 'changes', 'changes_preview', 'changesPreview') ?? null,
    };
  } catch {
    const fallbackTitle = relativePath.replace(/\.md$/iu, '').split('/').at(-1) ?? relativePath;
    return {
      title: fallbackTitle,
      category: null,
      displayPath: absolutePath,
      changesPreview: null,
    };
  }
};

const toIndexedFile = async (
  absolutePath: string,
  rootPath: string,
): Promise<IndexedMemoryMarkdownFile> => {
  const fileInfo = await stat(absolutePath);
  const relativePath = relativeVaultPath(rootPath, absolutePath);
  const name = relativePath.split('/').at(-1) ?? relativePath;
  const modifiedAtMs = fileInfo.mtime?.getTime() ?? 0;
  const metadata = await readFileMetadata(absolutePath, relativePath);

  return {
    absolutePath,
    relativePath,
    name,
    modifiedAt: fileInfo.mtime?.toISOString() ?? new Date(modifiedAtMs).toISOString(),
    ...metadata,
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
