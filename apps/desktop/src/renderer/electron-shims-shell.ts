/**
 * Shim for `@tauri-apps/plugin-shell` that dispatches to `window.tinker`
 * when running in Electron, or falls back to the real Tauri plugin.
 */

import { isElectronRuntime } from './runtime.js';

export const open = async (url: string): Promise<void> => {
  if (isElectronRuntime()) {
    const tinker = window.tinker;
    if (!tinker) {
      throw new Error('window.tinker is not available.');
    }
    return tinker.openExternal(url);
  }
  const m = await import('@tauri-apps/plugin-shell');
  return m.open(url);
};
