import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import nodePath from 'node:path';

export type DirEntry = {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
};

export type FileStatInfo = {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date | null;
};

export type WriteTextFileOptions = {
  append?: boolean;
  create?: boolean;
};

export const readDir = async (dirPath: string): Promise<DirEntry[]> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    isFile: entry.isFile(),
    isDirectory: entry.isDirectory(),
    isSymlink: entry.isSymbolicLink(),
  }));
};

export const readTextFile = async (filePath: string): Promise<string> => {
  return fs.readFile(filePath, 'utf-8');
};

export const readFile = async (filePath: string): Promise<Uint8Array> => {
  const buffer = await fs.readFile(filePath);
  return new Uint8Array(buffer);
};

export const writeTextFile = async (
  filePath: string,
  content: string,
  options?: WriteTextFileOptions,
): Promise<void> => {
  if (options?.append) {
    await fs.appendFile(filePath, content, 'utf-8');
  } else {
    await fs.writeFile(filePath, content, 'utf-8');
  }
};

export const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const stat = async (filePath: string): Promise<FileStatInfo> => {
  const s = await fs.stat(filePath);
  return {
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    size: s.size,
    mtime: s.mtime,
  };
};

export const mkdir = async (dirPath: string, options?: { recursive?: boolean }): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: options?.recursive ?? false });
};

export const remove = async (filePath: string, options?: { recursive?: boolean }): Promise<void> => {
  await fs.rm(filePath, { recursive: options?.recursive ?? false, force: true });
};

export const copyFile = async (src: string, dest: string): Promise<void> => {
  await fs.copyFile(src, dest);
};

export type WatchEvent = {
  paths: string[];
};

export const watch = async (
  dirPath: string,
  callback: (event: WatchEvent) => void,
  options?: { recursive?: boolean },
): Promise<() => void> => {
  const watcher = fsSync.watch(dirPath, { recursive: options?.recursive ?? false }, (_eventType, filename) => {
    if (filename) {
      callback({ paths: [nodePath.join(dirPath, filename)] });
    }
  });

  return () => {
    watcher.close();
  };
};
