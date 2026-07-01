/**
 * Electron main process.
 *
 * Responsibilities:
 *  1. Spawn host-service as a child process (or adopt an existing one).
 *  2. Generate PSK and pass it via env var.
 *  3. Wait for health.check, then create BrowserWindow with preload.
 *  4. Send connection info to renderer via IPC.
 *  5. On renderer reload: resend connection info (host stays alive).
 *  6. On quit: stop host unless headless mode is requested.
 *
 * Per ticket TIN-234: Electron launches/adopts, host-service owns all
 * workspace/session/run state. Do not put Goose lifecycle here.
 */

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { spawnHost, type HostHandle } from './hostLifecycle.js';

const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:']);

const guardUrl = (url: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
    throw new Error(`URL scheme "${parsed.protocol}" not allowed`);
  }
};

const isDev = !app.isPackaged;
const devUrl = process.env['TINKER_DEV_URL'] ?? 'http://localhost:5173/';

let hostHandle: HostHandle | null = null;
let mainWindow: BrowserWindow | null = null;

const sendConnectionToRenderer = (): void => {
  if (mainWindow === null || hostHandle === null) return;
  mainWindow.webContents.send('host-connection', hostHandle.connection);
};

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#0d0d0d',
    title: 'Tinker',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 13 },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: join(import.meta.dirname ?? __dirname, 'preload.ts'),
    },
  });

  win.once('ready-to-show', () => win.show());

  // Re-send connection info on navigation / reload so host survives reload.
  win.webContents.on('did-finish-load', sendConnectionToRenderer);

  if (isDev) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    guardUrl(url);
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow = win;
};

const bootHost = async (): Promise<void> => {
  const handle = await spawnHost({
    vaultRoot: null,
    port: 0,
  });
  hostHandle = handle;
};

app.whenReady().then(async () => {
  await bootHost();
  createWindow();
  sendConnectionToRenderer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      sendConnectionToRenderer();
    }
  });
}).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Tinker boot failed: ${msg}\n`);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    hostHandle?.stop();
    app.quit();
  }
});

app.on('before-quit', () => {
  hostHandle?.stop();
});
