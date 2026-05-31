import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../src/desktop-api-types.js';

const desktopApi: DesktopApi = {
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder') as Promise<string>,
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options) as Promise<string | null>,
  },
  fs: {
    readTextFile: (filePath) => ipcRenderer.invoke('fs:readTextFile', filePath) as Promise<string>,
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath) as Promise<Uint8Array>,
    writeTextFile: (filePath, contents) =>
      ipcRenderer.invoke('fs:writeTextFile', filePath, contents) as Promise<void>,
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath) as Promise<boolean>,
    stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
  app: {
    getHomePath: () => ipcRenderer.invoke('app:getHomePath') as Promise<string>,
    joinPath: (...segments: string[]) => ipcRenderer.invoke('app:joinPath', ...segments) as Promise<string>,
  },
  notification: {
    isPermissionGranted: () => ipcRenderer.invoke('notification:isPermissionGranted') as Promise<boolean>,
    requestPermission: () => ipcRenderer.invoke('notification:requestPermission') as Promise<'granted' | 'denied'>,
    send: (payload: { title: string; body: string }) =>
      ipcRenderer.invoke('notification:send', payload) as Promise<void>,
  },
  keychain: {
    saveRefreshToken: (provider, userId, token) =>
      ipcRenderer.invoke('keychain:saveRefreshToken', provider, userId, token) as Promise<void>,
    loadRefreshToken: (provider, userId) =>
      ipcRenderer.invoke('keychain:loadRefreshToken', provider, userId) as Promise<string | null>,
    clearRefreshToken: (provider, userId) =>
      ipcRenderer.invoke('keychain:clearRefreshToken', provider, userId) as Promise<void>,
    saveMcpSecret: (mcpId, secret) =>
      ipcRenderer.invoke('keychain:saveMcpSecret', mcpId, secret) as Promise<void>,
    loadMcpSecret: (mcpId) =>
      ipcRenderer.invoke('keychain:loadMcpSecret', mcpId) as Promise<string | null>,
    clearMcpSecret: (mcpId) =>
      ipcRenderer.invoke('keychain:clearMcpSecret', mcpId) as Promise<void>,
  },
  process: {
    startOpencode: (folderPath, userId, memorySubdir) =>
      ipcRenderer.invoke('process:startOpencode', folderPath, userId, memorySubdir),
    stopOpencode: (pid) =>
      ipcRenderer.invoke('process:stopOpencode', pid) as Promise<void>,
  },
  auth: {
    startSidecar: () => ipcRenderer.invoke('auth:startSidecar'),
    signIn: (provider) => ipcRenderer.invoke('auth:signIn', provider),
    signOut: (provider) =>
      ipcRenderer.invoke('auth:signOut', provider) as Promise<void>,
    status: () => ipcRenderer.invoke('auth:status'),
    restoreSession: (provider, userId) =>
      ipcRenderer.invoke('auth:restoreSession', provider, userId),
  },
  project: {
    getState: () => ipcRenderer.invoke('project:getState'),
    setMode: (mode) =>
      ipcRenderer.invoke('project:setMode', mode) as Promise<void>,
    addRecent: (project) =>
      ipcRenderer.invoke('project:addRecent', project) as Promise<void>,
    removeRecent: (projectPath) =>
      ipcRenderer.invoke('project:removeRecent', projectPath) as Promise<void>,
    setActiveRoot: (root) =>
      ipcRenderer.invoke('project:setActiveRoot', root) as Promise<void>,
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('tinker', desktopApi);
