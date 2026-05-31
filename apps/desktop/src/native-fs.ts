import { getDesktopApi } from './desktop-api.js';

const isTauri = (): boolean => getDesktopApi() === null && typeof window !== 'undefined';

export const readTextFile = async (path: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error('File system access requires Tauri or Electron shell.');
  }
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.readTextFile(path);
};

export const readFile = async (path: string): Promise<Uint8Array> => {
  if (!isTauri()) {
    throw new Error('File system access requires Tauri or Electron shell.');
  }
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.readFile(path);
};

export const writeTextFile = async (path: string, contents: string): Promise<void> => {
  if (!isTauri()) {
    throw new Error('File system write requires Tauri or Electron shell.');
  }
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.writeTextFile(path, contents);
};

export const exists = async (path: string): Promise<boolean> => {
  if (!isTauri()) {
    throw new Error('File system access requires Tauri or Electron shell.');
  }
  const mod = await import('@tauri-apps/plugin-fs');
  return mod.exists(path);
};

export const stat = async (path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> => {
  if (!isTauri()) {
    throw new Error('File system access requires Tauri or Electron shell.');
  }
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

type FileDialogOptions = {
  multiple?: boolean;
  directory?: boolean;
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
};

export const openFileDialog = async (options?: FileDialogOptions): Promise<string | null> => {
  const api = getDesktopApi();
  if (api) {
    const result = await api.dialog.openFolder();
    return result.length > 0 ? result : null;
  }
  const mod = await import('@tauri-apps/plugin-dialog');
  const result = await mod.open(options ?? { directory: false, multiple: false });
  return typeof result === 'string' ? result : null;
};
