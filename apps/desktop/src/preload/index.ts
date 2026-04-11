import { contextBridge, ipcRenderer } from 'electron';

const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_e: unknown, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld('glass', api);

declare global {
  interface Window {
    glass: typeof api;
  }
}
