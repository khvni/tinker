import { getDesktopApi } from './desktop-api.js';
import type { FileDialogOptions } from './desktop-api-types.js';

export type { FileDialogOptions };

const requireApi = () => {
  const api = getDesktopApi();
  if (!api) {
    throw new Error('Desktop API is not available. Ensure the Electron preload is loaded.');
  }
  return api;
};

export const readTextFile = async (path: string): Promise<string> => {
  return requireApi().fs.readTextFile(path);
};

export const readFile = async (path: string): Promise<Uint8Array> => {
  return requireApi().fs.readFile(path);
};

export const writeTextFile = async (path: string, contents: string): Promise<void> => {
  return requireApi().fs.writeTextFile(path, contents);
};

export const exists = async (path: string): Promise<boolean> => {
  return requireApi().fs.exists(path);
};

export const stat = async (path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> => {
  return requireApi().fs.stat(path);
};

export const openExternalUrl = async (url: string): Promise<void> => {
  return requireApi().shell.openExternal(url);
};

export const openFileDialog = async (options?: FileDialogOptions): Promise<string | null> => {
  const api = requireApi();
  if (options?.directory) {
    const result = await api.dialog.openFolder();
    return result.length > 0 ? result : null;
  }
  return api.dialog.openFile(options);
};
