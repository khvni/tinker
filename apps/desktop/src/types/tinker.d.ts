import type { TinkerAPI } from '../main/preload.js';

declare global {
  interface Window {
    tinker?: TinkerAPI;
  }
}
