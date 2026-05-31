/**
 * Shim for `@tauri-apps/plugin-dialog` that dispatches to `window.tinker`
 * when running in Electron, or falls back to the real Tauri plugin.
 */

import { isElectronRuntime } from './runtime.js';

type OpenDialogOptions = {
  multiple?: boolean;
  directory?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
  title?: string;
};

export const open = async (
  options?: OpenDialogOptions,
): Promise<string | string[] | null> => {
  if (isElectronRuntime()) {
    const tinker = window.tinker;
    if (!tinker) {
      throw new Error('window.tinker is not available.');
    }
    if (options?.directory) {
      const result = await tinker.openFolderPicker();
      return result || null;
    }
    // File picker is not yet implemented; stub returns null
    return null;
  }
  const m = await import('@tauri-apps/plugin-dialog');
  return m.open(options);
};
