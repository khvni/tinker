/**
 * Shim for `@tauri-apps/plugin-fs` that dispatches to `window.tinker`
 * when running in Electron, or falls back to the real Tauri plugin.
 */

import { isElectronRuntime } from './runtime.js';

const api = (): NonNullable<typeof window.tinker> => {
  const tinker = window.tinker;
  if (!tinker) {
    throw new Error('window.tinker is not available.');
  }
  return tinker;
};

export const readFile = async (path: string): Promise<Uint8Array<ArrayBuffer>> => {
  if (isElectronRuntime()) {
    const raw = await api().readFile(path);
    return new Uint8Array(raw);
  }
  const m = await import('@tauri-apps/plugin-fs');
  return m.readFile(path);
};

export const readTextFile = async (path: string): Promise<string> => {
  if (isElectronRuntime()) {
    return api().readTextFile(path);
  }
  const m = await import('@tauri-apps/plugin-fs');
  return m.readTextFile(path);
};

export const writeTextFile = async (path: string, content: string): Promise<void> => {
  if (isElectronRuntime()) {
    return api().writeTextFile(path, content);
  }
  const m = await import('@tauri-apps/plugin-fs');
  return m.writeTextFile(path, content);
};

export const exists = async (path: string): Promise<boolean> => {
  if (isElectronRuntime()) {
    return api().exists(path);
  }
  const m = await import('@tauri-apps/plugin-fs');
  return m.exists(path);
};
