import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  shell,
} from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { FileDialogOptions, ProjectMode, ProjectState, RecentProject } from '../src/desktop-api-types.js';

const isDev = !app.isPackaged;
const devUrl = process.env.TINKER_DEV_URL ?? 'http://localhost:1420/';

const MAX_RECENT_PROJECTS = 10;
const PROJECT_STORE_FILE = 'tinker-project-state.json';

const getProjectStorePath = (): string => {
  return path.join(app.getPath('userData'), PROJECT_STORE_FILE);
};

const readProjectState = (): ProjectState => {
  const fallback: ProjectState = {
    mode: 'no-project',
    recentProjects: [],
    activeRoot: os.homedir(),
  };

  try {
    const raw = fs.readFileSync(getProjectStorePath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const obj = parsed as Record<string, unknown>;
    return {
      mode: obj['mode'] === 'project' ? 'project' : 'no-project',
      recentProjects: Array.isArray(obj['recentProjects'])
        ? (obj['recentProjects'] as RecentProject[]).slice(0, MAX_RECENT_PROJECTS)
        : [],
      activeRoot: typeof obj['activeRoot'] === 'string' ? obj['activeRoot'] : os.homedir(),
    };
  } catch {
    return fallback;
  }
};

const writeProjectState = (state: ProjectState): void => {
  fs.writeFileSync(getProjectStorePath(), JSON.stringify(state, null, 2), 'utf-8');
};

const registerIpcHandlers = (): void => {
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled || result.filePaths.length === 0 ? '' : result.filePaths[0]!;
  });

  ipcMain.handle('dialog:openFile', async (_event, options?: FileDialogOptions) => {
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'createDirectory'> =
      options?.directory ? ['openDirectory', 'createDirectory'] : ['openFile'];
    if (options?.multiple) properties.push('multiSelections');
    const dialogFilters = options?.filters?.map((f) => ({ name: f.name, extensions: f.extensions }));
    const result = await dialog.showOpenDialog({
      title: options?.title,
      properties,
      filters: dialogFilters,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  // --- Path traversal / containment guard ---
// All FS IPC handlers operate on user-selected directories or app-managed paths.
// Reject any path that resolves outside its intended root (e.g. via "../" escape).

const containsPath = (filePath: string, root: string): boolean => {
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(root);
  return resolved.startsWith(rootResolved + path.sep) || resolved === rootResolved;
};

// Allowed roots for FS operations:
// - userData: app's own private directory (safe for keychain, settings, etc.)
// - projectRoots: directories the user has explicitly opened via dialog:openFolder
const allowedFsRoots = (): string[] => {
  const roots = [app.getPath('userData')];
  try {
    const state = readProjectState();
    for (const p of state.recentProjects) {
      if (p.path) roots.push(path.resolve(p.path));
    }
    if (state.activeRoot) roots.push(path.resolve(state.activeRoot));
  } catch {
    // ignore
  }
  return roots;
};

const guardFsPath = (filePath: string): void => {
  if (!filePath || typeof filePath !== 'string') throw new Error('Invalid path');
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) throw new Error('Path traversal not allowed');
  const allowed = allowedFsRoots();
  if (!allowed.some((root) => containsPath(normalized, root))) {
    throw new Error('Path outside allowed directory');
  }
};

// Allowed URL schemes for shell:openExternal
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

// --- File system ---
ipcMain.handle('fs:readTextFile', async (_event, filePath: string) => {
  guardFsPath(filePath);
  return fs.promises.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  guardFsPath(filePath);
  const buf = await fs.promises.readFile(filePath);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
});

ipcMain.handle('fs:writeTextFile', async (_event, filePath: string, contents: string) => {
  guardFsPath(filePath);
  await fs.promises.writeFile(filePath, contents, 'utf-8');
});

ipcMain.handle('fs:exists', async (_event, filePath: string) => {
  guardFsPath(filePath);
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  guardFsPath(filePath);
  const s = await fs.promises.stat(filePath);
  return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
});

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  guardUrl(url);
  await shell.openExternal(url);
});

  ipcMain.handle('app:getHomePath', () => os.homedir());

  ipcMain.handle('app:joinPath', (_event, ...segments: string[]) => {
    return path.join(...segments);
  });

  ipcMain.handle('notification:isPermissionGranted', () => {
    return Notification.isSupported();
  });

  ipcMain.handle('notification:requestPermission', () => {
    return Notification.isSupported() ? 'granted' : 'denied';
  });

  ipcMain.handle(
    'notification:send',
    (_event, payload: { title: string; body: string }) => {
      if (Notification.isSupported()) {
        new Notification(payload).show();
      }
    },
  );

  // --- Keychain ---
  // Uses safeStorage to encrypt/decrypt secrets. Encrypted blobs stored in userData/keychain/.
  // TODO: Migrate to @electron/keytar for true OS keychain (macOS Keychain, Windows Credential
  // Vault, Linux libsecret) once the native build pipeline supports it. safeStorage still uses
  // OS-level encryption (DPAPI on Windows, Keychain Services on macOS for the master key).
  const keychainDir = (): string => {
    const dir = path.join(app.getPath('userData'), 'keychain');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  const keychainPath = (namespace: string, key: string): string => {
    const safeKey = Buffer.from(`${namespace}:${key}`).toString('base64url');
    return path.join(keychainDir(), `${safeKey}.enc`);
  };

  ipcMain.handle(
    'keychain:saveRefreshToken',
    async (_event, provider: string, userId: string, token: string) => {
      const { safeStorage } = await import('electron');
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(keychainPath('refresh', `${provider}:${userId}`), encrypted);
    },
  );

  ipcMain.handle(
    'keychain:loadRefreshToken',
    async (_event, provider: string, userId: string) => {
      const { safeStorage } = await import('electron');
      const filePath = keychainPath('refresh', `${provider}:${userId}`);
      if (!fs.existsSync(filePath)) return null;
      const encrypted = fs.readFileSync(filePath);
      return safeStorage.decryptString(encrypted);
    },
  );

  ipcMain.handle(
    'keychain:clearRefreshToken',
    (_event, provider: string, userId: string) => {
      const filePath = keychainPath('refresh', `${provider}:${userId}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    },
  );

  ipcMain.handle(
    'keychain:saveMcpSecret',
    async (_event, mcpId: string, secret: string) => {
      const { safeStorage } = await import('electron');
      const encrypted = safeStorage.encryptString(secret);
      fs.writeFileSync(keychainPath('mcp', mcpId), encrypted);
    },
  );

  ipcMain.handle('keychain:loadMcpSecret', async (_event, mcpId: string) => {
    const { safeStorage } = await import('electron');
    const filePath = keychainPath('mcp', mcpId);
    if (!fs.existsSync(filePath)) return null;
    const encrypted = fs.readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  });

  ipcMain.handle('keychain:clearMcpSecret', (_event, mcpId: string) => {
    const filePath = keychainPath('mcp', mcpId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  // --- Process lifecycle ---
  // Stubs for OpenCode sidecar management. Full implementation depends on
  // the host-service layer; these handlers provide the IPC contract.
  ipcMain.handle(
    'process:startOpencode',
    async (_event, _folderPath: string, _userId: string, _memorySubdir: string) => {
      // TODO(TIN-233): Wire to host-service coordinator once available.
      throw new Error('process:startOpencode not yet wired to host-service.');
    },
  );

  ipcMain.handle('process:stopOpencode', async (_event, _pid: number) => {
    // TODO(TIN-233): Wire to host-service coordinator once available.
    throw new Error('process:stopOpencode not yet wired to host-service.');
  });

  // --- Auth ---
  // Stubs for auth sidecar management. Auth flows will be wired through
  // the host-service or a dedicated auth sidecar process.
  ipcMain.handle('auth:startSidecar', async () => {
    throw new Error('auth:startSidecar not yet wired.');
  });

  ipcMain.handle('auth:signIn', async (_event, _provider: string) => {
    throw new Error('auth:signIn not yet wired.');
  });

  ipcMain.handle('auth:signOut', async (_event, _provider: string) => {
    throw new Error('auth:signOut not yet wired.');
  });

  ipcMain.handle('auth:status', async () => {
    return { google: null, github: null, microsoft: null };
  });

  ipcMain.handle(
    'auth:restoreSession',
    async (_event, _provider: string, _userId: string) => {
      return null;
    },
  );

  // --- Project state ---
  ipcMain.handle('project:getState', () => readProjectState());

  ipcMain.handle('project:setMode', (_event, mode: ProjectMode) => {
    const state = readProjectState();
    writeProjectState({ ...state, mode });
  });

  ipcMain.handle('project:addRecent', (_event, project: RecentProject) => {
    const state = readProjectState();
    const filtered = state.recentProjects.filter((p) => p.path !== project.path);
    const recentProjects = [project, ...filtered].slice(0, MAX_RECENT_PROJECTS);
    writeProjectState({ ...state, recentProjects });
  });

  ipcMain.handle('project:removeRecent', (_event, projectPath: string) => {
    const state = readProjectState();
    const recentProjects = state.recentProjects.filter((p) => p.path !== projectPath);
    writeProjectState({ ...state, recentProjects });
  });

  ipcMain.handle('project:setActiveRoot', (_event, root: string) => {
    const state = readProjectState();
    writeProjectState({ ...state, activeRoot: root });
  });
};

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#fbf8f2',
    title: 'Tinker',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 13 },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
};

void app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
