import { getDesktopApi } from './desktop-api.js';
import type { FileDialogOptions } from './desktop-api-types.js';

export type { FileDialogOptions };

export const readTextFile = async (path: string): Promise<string> => {
  const api = getDesktopApi();
  if (api) return api.fs.readTextFile(path);
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.readTextFile(path);
};

export const readFile = async (path: string): Promise<Uint8Array> => {
  const api = getDesktopApi();
  if (api) return api.fs.readFile(path);
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.readFile(path);
};

export const writeTextFile = async (path: string, contents: string): Promise<void> => {
  const api = getDesktopApi();
  if (api) return api.fs.writeTextFile(path, contents);
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.writeTextFile(path, contents);
};

export const exists = async (path: string): Promise<boolean> => {
  const api = getDesktopApi();
  if (api) return api.fs.exists(path);
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.exists(path);
};

export const stat = async (path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> => {
  const api = getDesktopApi();
  if (api) return api.fs.stat(path);
  const mod = await import('@tauri-apps/plugin-fs');
  const s = await mod.stat(path);
  return { isFile: s.isFile, isDirectory: s.isDirectory, size: s.size };
};

export const openExternalUrl = async (url: string): Promise<void> => {
  const api = getDesktopApi();
  if (api) return api.shell.openExternal(url);
  const mod = await import('@tauri-apps/plugin-shell');
  return mod.open(url);
};

export const openFileDialog = async (options?: FileDialogOptions): Promise<string | null> => {
  const api = getDesktopApi();
  if (api) {
    if (options?.directory) {
      const result = await api.dialog.openFolder();
      return result.length > 0 ? result : null;
    }
    return api.dialog.openFile(options);
  }
  const mod = await import('@tauri-apps/plugin-dialog');
  const result = await mod.open(options ?? { directory: false, multiple: false });
  return typeof result === 'string' ? result : null;
};
