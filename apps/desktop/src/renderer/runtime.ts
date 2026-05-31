import type { DesktopApi } from '../desktop-api-types.js';

type TauriRuntimeWindow = Window &
  typeof globalThis & {
    __TAURI_INTERNALS__?: {
      invoke?: unknown;
    };
  };

type ElectronRuntimeWindow = Window &
  typeof globalThis & {
    tinker?: DesktopApi;
  };

export type RuntimeKind = 'electron' | 'tauri' | 'web';

export const detectRuntime = (): RuntimeKind => {
  if (typeof window === 'undefined') return 'web';

  if ((window as ElectronRuntimeWindow).tinker !== undefined) return 'electron';

  const tauri = (window as TauriRuntimeWindow).__TAURI_INTERNALS__;
  if (typeof tauri?.invoke === 'function') return 'tauri';

  return 'web';
};

export const isTauriRuntime = (): boolean => detectRuntime() === 'tauri';

export const isElectronRuntime = (): boolean => detectRuntime() === 'electron';

export const isNativeRuntime = (): boolean => {
  const runtime = detectRuntime();
  return runtime === 'electron' || runtime === 'tauri';
};

