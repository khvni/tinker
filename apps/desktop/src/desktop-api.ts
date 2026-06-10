import type { DesktopApi } from './desktop-api-types.js';

type TinkerWindow = Window &
  typeof globalThis & {
    tinker?: DesktopApi;
  };

export const getDesktopApi = (): DesktopApi | null => {
  if (typeof window === 'undefined') return null;
  return (window as TinkerWindow).tinker ?? null;
};

export const hasDesktopApi = (): boolean => getDesktopApi() !== null;
