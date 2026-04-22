import { stat } from '@tauri-apps/plugin-fs';
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

export const listMemoryMarkdownFiles = async (
  userId: string,
  runtimePlatform: string | undefined = globalThis.process?.platform,
): Promise<MemoryMarkdownFile[]> => {
  const activeMemoryPath = await getActiveMemoryPath(userId, runtimePlatform);
  const markdownFiles = await walkMarkdownFiles(activeMemoryPath);
  const indexedFiles = await Promise.all(
    markdownFiles.map(async (absolutePath): Promise<IndexedMemoryMarkdownFile> => {
      const fileInfo = await stat(absolutePath);
      const relativePath = relativeVaultPath(activeMemoryPath, absolutePath);
      const modifiedAtMs = fileInfo.mtime?.getTime() ?? 0;

      return {
        absolutePath,
        relativePath,
        name: relativePath.split('/').at(-1) ?? relativePath,
        modifiedAt: fileInfo.mtime?.toISOString() ?? new Date(modifiedAtMs).toISOString(),
        modifiedAtMs,
      };
    }),
  );

  return indexedFiles
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs || left.relativePath.localeCompare(right.relativePath))
    .map(({ modifiedAtMs: _modifiedAtMs, ...file }) => file);
};
