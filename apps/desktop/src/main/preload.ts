import { contextBridge, ipcRenderer } from 'electron';

export type TinkerAPI = {
  readonly platform: NodeJS.Platform;
  homeDir(): Promise<string>;
  joinPath(...segments: string[]): Promise<string>;
  openExternal(url: string): Promise<void>;
  openFolderPicker(): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number; mtime: number }>;
  isNotificationPermissionGranted(): Promise<boolean>;
  sendNotification(title: string, body?: string): Promise<void>;
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
};

const tinker: TinkerAPI = {
  platform: process.platform,

  homeDir: () => ipcRenderer.invoke('tinker:homeDir'),

  joinPath: (...segments: string[]) =>
    ipcRenderer.invoke('tinker:joinPath', ...segments),

  openExternal: (url: string) =>
    ipcRenderer.invoke('tinker:openExternal', url),

  openFolderPicker: () =>
    ipcRenderer.invoke('tinker:openFolderPicker'),

  readFile: (path: string) =>
    ipcRenderer.invoke('tinker:readFile', path),

  readTextFile: (path: string) =>
    ipcRenderer.invoke('tinker:readTextFile', path),

  writeTextFile: (path: string, content: string) =>
    ipcRenderer.invoke('tinker:writeTextFile', path, content),

  exists: (path: string) =>
    ipcRenderer.invoke('tinker:exists', path),

  stat: (path: string) =>
    ipcRenderer.invoke('tinker:stat', path),

  isNotificationPermissionGranted: () =>
    ipcRenderer.invoke('tinker:isNotificationPermissionGranted'),

  sendNotification: (title: string, body?: string) =>
    ipcRenderer.invoke('tinker:sendNotification', title, body),

  invoke: <T = unknown>(command: string, args?: Record<string, unknown>) =>
    ipcRenderer.invoke('tinker:invoke', command, args) as Promise<T>,
};

contextBridge.exposeInMainWorld('tinker', tinker);
