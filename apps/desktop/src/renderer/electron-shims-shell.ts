/**
 * Electron-only shell layer. Delegates to `window.tinker` (Electron preload).
 */

export const open = async (url: string): Promise<void> => {
  const tinker = window.tinker;
  if (!tinker) {
    throw new Error('window.tinker is not available.');
  }
  return tinker.openExternal(url);
};
