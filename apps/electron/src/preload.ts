/**
 * Electron preload — exposes host connection info to the renderer.
 *
 * The main process sends `'host-connection'` once the host is healthy.
 * The renderer calls `window.tinkerBridge.getHostConnection()` and gets
 * a promise that resolves to `{ baseUrl, secret, hostId }`.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { HostConnectionInfo, TinkerBridge } from './hostBridge.js';

let cached: HostConnectionInfo | null = null;
let pending: Array<{ resolve: (v: HostConnectionInfo) => void }> = [];

ipcRenderer.on('host-connection', (_event, info: HostConnectionInfo) => {
  cached = info;
  for (const waiter of pending) {
    waiter.resolve(info);
  }
  pending = [];
});

const bridge: TinkerBridge = {
  getHostConnection: () => {
    if (cached !== null) return Promise.resolve(cached);
    return new Promise<HostConnectionInfo>((resolve) => {
      pending.push({ resolve });
    });
  },
};

contextBridge.exposeInMainWorld('tinkerBridge', bridge);
