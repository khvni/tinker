/**
 * Electron-only dialog layer. Delegates to `window.tinker` (Electron preload).
 */

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
  const tinker = window.tinker;
  if (!tinker) {
    throw new Error('window.tinker is not available.');
  }
  if (options?.directory) {
    const result = await tinker.openFolderPicker();
    return result || null;
  }
  return null;
};
