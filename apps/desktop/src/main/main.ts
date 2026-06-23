import { app, BrowserWindow, ipcMain, shell, dialog, Notification } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readFile, writeFile, access, stat } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://127.0.0.1:1420';
const IS_DEV = !app.isPackaged;

const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 900;
const MIN_WIDTH = 960;
const MIN_HEIGHT = 600;

/** Schemes permitted for tinker:openExternal — prevents javascript: and file: traversal. */
const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

/** Returns url if its scheme is allowed; otherwise throws. Guard runs at the main layer even if the renderer already validated. */
const guardUrl = (url: string): string => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (!ALLOWED_URL_SCHEMES.has(protocol)) {
    throw new Error(`Refusing to open URL with disallowed scheme: ${protocol}`);
  }
  return url;
};

const createWindow = (): BrowserWindow => {
  const preloadPath = join(__dirname, 'preload.mjs');

  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'Tinker',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (IS_DEV) {
    void window.loadURL(DEV_SERVER_URL);
  } else {
    void window.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  return window;
};

const registerIpcHandlers = (): void => {
  ipcMain.handle('tinker:homeDir', () => homedir());

  ipcMain.handle('tinker:joinPath', (_event, ...segments: string[]) =>
    join(...segments),
  );

  ipcMain.handle('tinker:openExternal', async (_event, url: string) => {
    await shell.openExternal(guardUrl(url));
  });

  ipcMain.handle('tinker:openFolderPicker', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return '';
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.filePaths[0] ?? '';
  });

  ipcMain.handle('tinker:readFile', async (_event, filePath: string) => {
    const buffer = await readFile(filePath);
    return buffer;
  });

  ipcMain.handle('tinker:readTextFile', async (_event, filePath: string) => {
    return readFile(filePath, 'utf-8');
  });

  ipcMain.handle('tinker:writeTextFile', async (_event, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('tinker:exists', async (_event, filePath: string) => {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('tinker:stat', async (_event, filePath: string) => {
    const info = await stat(filePath);
    return {
      isFile: info.isFile(),
      isDirectory: info.isDirectory(),
      size: info.size,
      mtime: info.mtimeMs,
    };
  });

  ipcMain.handle('tinker:sendNotification', (_event, title: string, body?: string) => {
    if (Notification.isSupported()) {
      const notification = new Notification(body ? { title, body } : { title });
      notification.show();
    }
  });

  ipcMain.handle('tinker:isNotificationPermissionGranted', () => {
    return Notification.isSupported();
  });

  ipcMain.handle('tinker:invoke', async (_event, _command: string, _args?: Record<string, unknown>) => {
    // Stub: native command invocation is implemented in later tickets
    // when specific sidecar and keychain integrations are ported from Rust.
    throw new Error('tinker:invoke is not yet implemented. Native commands will be ported in subsequent tickets.');
  });
};

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
