/**
 * Electron-only FS layer. Delegates to `window.tinker` (Electron preload).
 */

const api = (): NonNullable<typeof window.tinker> => {
  const tinker = window.tinker;
  if (!tinker) {
    throw new Error('window.tinker is not available.');
  }
  return tinker;
};

export const readFile = async (path: string): Promise<Uint8Array<ArrayBuffer>> => {
  const raw = await api().readFile(path);
  return new Uint8Array(raw);
};

export const readTextFile = async (path: string): Promise<string> => {
  return api().readTextFile(path);
};

export const writeTextFile = async (path: string, content: string): Promise<void> => {
  return api().writeTextFile(path, content);
};

export const exists = async (path: string): Promise<boolean> => {
  return api().exists(path);
};
