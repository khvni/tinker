/**
 * Shim layer that maps the Tauri API surface used by the renderer to
 * `window.tinker` (Electron preload) or falls back to the real Tauri
 * imports when running inside a Tauri shell.
 *
 * This lets the renderer source migrate incrementally: callers import
 * from this module instead of `@tauri-apps/*`, and the implementation
 * dispatches to whichever runtime is available.
 */

import { isElectronRuntime } from './runtime.js';

const api = (): NonNullable<typeof window.tinker> => {
  const tinker = window.tinker;
  if (!tinker) {
    throw new Error('window.tinker is not available. Ensure the Electron preload is loaded.');
  }
  return tinker;
};

// ── @tauri-apps/api/core ───────────────────────────────────────────
export const invoke = <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> => {
  if (isElectronRuntime()) {
    return api().invoke<T>(command, args);
  }
  // Lazy-import Tauri for backwards compat during migration
  return import('@tauri-apps/api/core').then((m) => m.invoke<T>(command, args));
};

// ── @tauri-apps/api/path ───────────────────────────────────────────
export const homeDir = async (): Promise<string> => {
  if (isElectronRuntime()) {
    return api().homeDir();
  }
  const m = await import('@tauri-apps/api/path');
  return m.homeDir();
};

export const join = async (...segments: string[]): Promise<string> => {
  if (isElectronRuntime()) {
    return api().joinPath(...segments);
  }
  const m = await import('@tauri-apps/api/path');
  return m.join(...segments);
};

// ── @tauri-apps/plugin-shell ───────────────────────────────────────
export const openExternal = async (url: string): Promise<void> => {
  if (isElectronRuntime()) {
    return api().openExternal(url);
  }
  const m = await import('@tauri-apps/plugin-shell');
  return m.open(url);
};

// ── @tauri-apps/plugin-notification ────────────────────────────────
export const isPermissionGranted = async (): Promise<boolean> => {
  if (isElectronRuntime()) {
    return api().isNotificationPermissionGranted();
  }
  const m = await import('@tauri-apps/plugin-notification');
  return m.isPermissionGranted();
};

export const requestPermission = async (): Promise<string> => {
  if (isElectronRuntime()) {
    // Electron handles notification permissions at OS level
    return 'granted';
  }
  const m = await import('@tauri-apps/plugin-notification');
  const result = await m.requestPermission();
  return String(result);
};

export const sendNotification = async (options: string | { title: string; body?: string }): Promise<void> => {
  if (isElectronRuntime()) {
    const title = typeof options === 'string' ? options : options.title;
    const body = typeof options === 'string' ? undefined : options.body;
    return api().sendNotification(title, body);
  }
  const m = await import('@tauri-apps/plugin-notification');
  m.sendNotification(options);
};
