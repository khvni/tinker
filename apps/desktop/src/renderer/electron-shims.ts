/**
 * Electron-only shim layer. Now that Tauri has been removed, these helpers
 * simply delegate to `window.tinker` (Electron preload).
 */

const api = (): NonNullable<typeof window.tinker> => {
  const tinker = window.tinker;
  if (!tinker) {
    throw new Error('window.tinker is not available. Ensure the Electron preload is loaded.');
  }
  return tinker;
};

// ── core ───────────────────────────────────────────────────────────
export const invoke = <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> => {
  return api().invoke<T>(command, args);
};

// ── path ───────────────────────────────────────────────────────────
export const homeDir = async (): Promise<string> => {
  return api().homeDir();
};

export const join = async (...segments: string[]): Promise<string> => {
  return api().joinPath(...segments);
};

// ── shell ──────────────────────────────────────────────────────────
export const openExternal = async (url: string): Promise<void> => {
  return api().openExternal(url);
};

// ── notification ───────────────────────────────────────────────────
export const isPermissionGranted = async (): Promise<boolean> => {
  return api().isNotificationPermissionGranted();
};

export const requestPermission = async (): Promise<string> => {
  return 'granted';
};

export const sendNotification = async (options: string | { title: string; body?: string }): Promise<void> => {
  const title = typeof options === 'string' ? options : options.title;
  const body = typeof options === 'string' ? undefined : options.body;
  return api().sendNotification(title, body);
};
