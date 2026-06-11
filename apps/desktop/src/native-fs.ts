import { getDesktopApi } from './desktop-api.js';
import type { FileDialogOptions } from './desktop-api-types.js';

export type { FileDialogOptions };

const api = getDesktopApi();
if (!api) throw new Error('Desktop API not available in this environment');

export const readTextFile = async (path: string): Promise<string> => {
  return api.fs.readTextFile(path);
};

export const readFile = async (path: string): Promise<Uint8Array> => {
  return api.fs.readFile(path);
};

export const writeTextFile = async (path: string, contents: string): Promise<void> => {
  return api.fs.writeTextFile(path, contents);
};

export const exists = async (path: string): Promise<boolean> => {
  return api.fs.exists(path);
};

export const stat = async (path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> => {
  return api.fs.stat(path);
};

export const openExternalUrl = async (url: string): Promise<void> => {
  return api.shell.openExternal(url);
};

export const openFileDialog = async (options?: FileDialogOptions): Promise<string | null> => {
  if (options?.directory) {
    const result = await api.dialog.openFolder();
    return result.length > 0 ? result : null;
  }
  return api.dialog.openFile(options);
};
