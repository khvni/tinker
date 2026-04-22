import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCopyFile,
  mockCreateSettingsStore,
  mockDataDir,
  mockExists,
  mockJoin,
  mockMkdir,
  mockReadDir,
  mockRemove,
  mockSettingsGet,
  mockSettingsSet,
  mockWriteTextFile,
} = vi.hoisted(() => ({
  mockCopyFile: vi.fn<(source: string, destination: string) => Promise<void>>(),
  mockCreateSettingsStore: vi.fn(),
  mockDataDir: vi.fn<() => Promise<string>>(),
  mockExists: vi.fn<(path: string) => Promise<boolean>>(),
  mockJoin: vi.fn<(...paths: string[]) => Promise<string>>(),
  mockMkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
  mockReadDir: vi.fn<(path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }>>>(),
  mockRemove: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockWriteTextFile: vi.fn<(path: string, contents: string) => Promise<void>>(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  dataDir: mockDataDir,
  join: mockJoin,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: mockCopyFile,
  exists: mockExists,
  mkdir: mockMkdir,
  readDir: mockReadDir,
  remove: mockRemove,
  writeTextFile: mockWriteTextFile,
}));

vi.mock('./settings-store.js', () => ({
  createSettingsStore: mockCreateSettingsStore,
}));

import {
  defaultMemoryRootSegments,
  detectMemoryRootPlatform,
  ensureDefaultMemoryRoot,
  getActiveMemoryPath,
  getMemoryRoot,
  moveMemoryRoot,
  resolveDefaultMemoryRoot,
  syncActiveMemoryPath,
  subscribeMemoryPathChanged,
  validateMemoryRootWritable,
} from './memory-paths.js';

const stubProcessPlatform = (platform: NodeJS.Platform): void => {
  vi.stubGlobal('process', { ...process, platform });
};

const makeSetting = (path: string) => ({
  key: 'memory_root',
  value: { path },
  updatedAt: '2026-04-22T00:00:00.000Z',
});

const createDirEntry = (name: string, kind: 'directory' | 'file') => ({
  name,
  isDirectory: kind === 'directory',
  isFile: kind === 'file',
  isSymlink: false,
});

describe('detectMemoryRootPlatform', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers process.platform for macOS', () => {
    stubProcessPlatform('darwin');
    expect(detectMemoryRootPlatform('/tmp/not-used')).toBe('macos');
  });

  it('prefers process.platform for Windows', () => {
    stubProcessPlatform('win32');
    expect(detectMemoryRootPlatform('/tmp/not-used')).toBe('windows');
  });

  it('prefers process.platform for Linux', () => {
    stubProcessPlatform('linux');
    expect(detectMemoryRootPlatform('/tmp/not-used')).toBe('linux');
  });

  it('falls back to the data directory when process is unavailable', () => {
    vi.stubGlobal('process', undefined);

    expect(detectMemoryRootPlatform('/Users/alice/Library/Application Support')).toBe('macos');
    expect(detectMemoryRootPlatform('C:\\Users\\Alice\\AppData\\Roaming')).toBe('windows');
    expect(detectMemoryRootPlatform('/home/alice/.local/share')).toBe('linux');
  });
});

describe('defaultMemoryRootSegments', () => {
  it('uses lowercase app directory on linux', () => {
    expect(defaultMemoryRootSegments('/home/alice/.local/share', 'linux')).toEqual(['tinker', 'memory']);
  });

  it('uses title case app directory on macOS and Windows', () => {
    expect(defaultMemoryRootSegments('/Users/alice/Library/Application Support', 'darwin')).toEqual([
      'Tinker',
      'memory',
    ]);
    expect(defaultMemoryRootSegments('C:\\Users\\Alice\\AppData\\Roaming', 'win32')).toEqual(['Tinker', 'memory']);
  });
});

describe('default memory root resolution', () => {
  beforeEach(() => {
    mockCopyFile.mockReset();
    mockCreateSettingsStore.mockReset();
    mockDataDir.mockReset();
    mockExists.mockReset();
    mockJoin.mockReset();
    mockMkdir.mockReset();
    mockReadDir.mockReset();
    mockRemove.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockWriteTextFile.mockReset();
    vi.unstubAllGlobals();

    mockCreateSettingsStore.mockReturnValue({
      get: mockSettingsGet,
      set: mockSettingsSet,
    });
    mockJoin.mockImplementation(async (...parts: string[]) => {
      return parts.join('/').replace(/\/+/gu, '/');
    });
    mockMkdir.mockResolvedValue();
    mockExists.mockResolvedValue(false);
    mockReadDir.mockResolvedValue([]);
    mockCopyFile.mockResolvedValue();
    mockRemove.mockResolvedValue();
    mockWriteTextFile.mockResolvedValue();
    mockSettingsSet.mockResolvedValue(undefined);
  });

  it('resolves the linux default root under ~/.local/share/tinker/memory', async () => {
    mockDataDir.mockResolvedValue('/home/alice/.local/share');
    mockJoin.mockResolvedValue('/home/alice/.local/share/tinker/memory');

    await expect(resolveDefaultMemoryRoot('linux')).resolves.toBe('/home/alice/.local/share/tinker/memory');
    expect(mockJoin).toHaveBeenCalledWith('/home/alice/.local/share', 'tinker', 'memory');
  });

  it('resolves the macOS default root under ~/Library/Application Support/Tinker/memory', async () => {
    mockDataDir.mockResolvedValue('/Users/alice/Library/Application Support');
    mockJoin.mockResolvedValue('/Users/alice/Library/Application Support/Tinker/memory');

    await expect(resolveDefaultMemoryRoot('darwin')).resolves.toBe('/Users/alice/Library/Application Support/Tinker/memory');
    expect(mockJoin).toHaveBeenCalledWith('/Users/alice/Library/Application Support', 'Tinker', 'memory');
  });

  it('resolves the Windows default root under %APPDATA%/Tinker/memory', async () => {
    mockDataDir.mockResolvedValue('C:\\Users\\Alice\\AppData\\Roaming');
    mockJoin.mockResolvedValue('C:\\Users\\Alice\\AppData\\Roaming\\Tinker\\memory');

    await expect(resolveDefaultMemoryRoot('win32')).resolves.toBe('C:\\Users\\Alice\\AppData\\Roaming\\Tinker\\memory');
    expect(mockJoin).toHaveBeenCalledWith('C:\\Users\\Alice\\AppData\\Roaming', 'Tinker', 'memory');
  });

  it('creates the directory with recursive mkdir semantics', async () => {
    mockDataDir.mockResolvedValue('/home/alice/.local/share');
    mockJoin.mockResolvedValue('/home/alice/.local/share/tinker/memory');
    mockMkdir.mockResolvedValue();

    await expect(ensureDefaultMemoryRoot('linux')).resolves.toBe('/home/alice/.local/share/tinker/memory');
    expect(mockMkdir).toHaveBeenCalledWith('/home/alice/.local/share/tinker/memory', { recursive: true });
  });

  it('seeds memory_root once when no setting exists', async () => {
    mockDataDir.mockResolvedValue('/home/alice/.local/share');
    mockSettingsGet.mockResolvedValue(null);

    await expect(getMemoryRoot('linux')).resolves.toBe('/home/alice/.local/share/tinker/memory');

    expect(mockSettingsSet).toHaveBeenCalledTimes(1);
    expect(mockSettingsSet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'memory_root',
        value: { path: '/home/alice/.local/share/tinker/memory' },
      }),
    );
  });

  it('reuses existing memory_root without overwriting it', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/tmp/custom-memory'));

    await expect(getMemoryRoot('linux')).resolves.toBe('/tmp/custom-memory');

    expect(mockSettingsSet).not.toHaveBeenCalled();
    expect(mockMkdir).toHaveBeenCalledWith('/tmp/custom-memory', { recursive: true });
  });

  it('resolves active memory path from settings on every call', async () => {
    mockSettingsGet.mockResolvedValueOnce(makeSetting('/tmp/memory-a')).mockResolvedValueOnce(makeSetting('/tmp/memory-b'));

    await expect(getActiveMemoryPath('user-1', 'linux')).resolves.toBe('/tmp/memory-a/user-1');
    await expect(getActiveMemoryPath('user-1', 'linux')).resolves.toBe('/tmp/memory-b/user-1');

    expect(mockJoin).toHaveBeenCalledWith('/tmp/memory-a', 'user-1');
    expect(mockJoin).toHaveBeenCalledWith('/tmp/memory-b', 'user-1');
  });

  it('validates that a candidate memory root is writable', async () => {
    mockJoin.mockResolvedValueOnce('/tmp/new-memory/.tinker-memory-root-probe-test.tmp');
    mockExists.mockResolvedValue(true);

    await expect(validateMemoryRootWritable('/tmp/new-memory')).resolves.toBeUndefined();

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      '/tmp/new-memory/.tinker-memory-root-probe-test.tmp',
      'tinker-memory-root-probe',
    );
    expect(mockRemove).toHaveBeenCalledWith('/tmp/new-memory/.tinker-memory-root-probe-test.tmp');
  });

  it('moves memory root, updates setting, and emits path-changed progress', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/old-memory'));
    mockExists.mockResolvedValue(false);
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/old-memory') {
        return [createDirEntry('profile.md', 'file'), createDirEntry('sessions', 'directory')];
      }

      if (path === '/old-memory/sessions') {
        return [createDirEntry('2026-04-22.md', 'file')];
      }

      return [];
    });

    const progress = vi.fn();
    const listener = vi.fn();
    const unsubscribe = subscribeMemoryPathChanged(listener);

    await expect(moveMemoryRoot('/new-memory', { onProgress: progress, runtimePlatform: 'linux' })).resolves.toBe(
      '/new-memory',
    );

    unsubscribe();

    expect(mockCopyFile).toHaveBeenCalledWith('/old-memory/profile.md', '/new-memory/profile.md');
    expect(mockCopyFile).toHaveBeenCalledWith('/old-memory/sessions/2026-04-22.md', '/new-memory/sessions/2026-04-22.md');
    expect(mockRemove).toHaveBeenCalledWith('/old-memory', { recursive: true });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'memory_root',
        value: { path: '/new-memory' },
      }),
    );
    expect(listener).toHaveBeenCalledWith({
      previousRoot: '/old-memory',
      nextRoot: '/new-memory',
      previousPath: null,
      nextPath: null,
      previousUserId: null,
      nextUserId: null,
    });
    expect(progress).toHaveBeenNthCalledWith(1, {
      copiedFiles: 0,
      totalFiles: 2,
      currentPath: null,
    });
    expect(progress).toHaveBeenLastCalledWith({
      copiedFiles: 2,
      totalFiles: 2,
      currentPath: 'sessions/2026-04-22.md',
    });
  });

  it('rejects non-empty destination folders before copying anything', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/old-memory'));
    mockExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([createDirEntry('existing.md', 'file')]);

    await expect(moveMemoryRoot('/new-memory', { runtimePlatform: 'linux' })).rejects.toThrow(
      'Pick an empty folder for the new memory location.',
    );

    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalled();
  });

  it('rolls back copied files when move fails', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/old-memory'));
    mockExists.mockResolvedValue(false);
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/old-memory') {
        return [createDirEntry('profile.md', 'file')];
      }

      return [];
    });
    mockCopyFile.mockRejectedValueOnce(new Error('disk full'));

    const listener = vi.fn();
    const unsubscribe = subscribeMemoryPathChanged(listener);

    await expect(moveMemoryRoot('/new-memory', { runtimePlatform: 'linux' })).rejects.toThrow('disk full');

    unsubscribe();

    expect(mockSettingsSet).not.toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalledWith('/new-memory', { recursive: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects next root nested inside current root', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/old-memory'));

    await expect(moveMemoryRoot('/old-memory/nested', { runtimePlatform: 'linux' })).rejects.toThrow(
      'New memory folder cannot be inside current memory folder.',
    );

    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalled();
  });

  it('rejects next root that contains current root', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/old-memory/inner'));

    await expect(moveMemoryRoot('/old-memory', { runtimePlatform: 'linux' })).rejects.toThrow(
      'New memory folder cannot contain current memory folder.',
    );

    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalled();
  });

  it('keeps old root intact when settings write fails after copy', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/old-memory'));
    mockExists.mockResolvedValue(false);
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/old-memory') {
        return [createDirEntry('profile.md', 'file')];
      }
      if (path === '/new-memory') {
        return [createDirEntry('profile.md', 'file')];
      }
      return [];
    });
    mockSettingsSet.mockRejectedValueOnce(new Error('settings lock'));

    const listener = vi.fn();
    const unsubscribe = subscribeMemoryPathChanged(listener);

    await expect(moveMemoryRoot('/new-memory', { runtimePlatform: 'linux' })).rejects.toThrow('settings lock');

    unsubscribe();

    expect(mockRemove).not.toHaveBeenCalledWith('/old-memory', { recursive: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it('emits only when the active user path changes', async () => {
    mockSettingsGet.mockResolvedValue(makeSetting('/memory-root'));

    const listener = vi.fn();
    const unsubscribe = subscribeMemoryPathChanged(listener);

    await expect(syncActiveMemoryPath('user-1', { runtimePlatform: 'linux' })).resolves.toBe('/memory-root/user-1');
    await expect(syncActiveMemoryPath('user-1', { runtimePlatform: 'linux' })).resolves.toBe('/memory-root/user-1');
    await expect(syncActiveMemoryPath('user-2', { runtimePlatform: 'linux' })).resolves.toBe('/memory-root/user-2');

    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, {
      previousRoot: '/memory-root',
      nextRoot: '/memory-root',
      previousPath: null,
      nextPath: '/memory-root/user-1',
      previousUserId: null,
      nextUserId: 'user-1',
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      previousRoot: '/memory-root',
      nextRoot: '/memory-root',
      previousPath: '/memory-root/user-1',
      nextPath: '/memory-root/user-2',
      previousUserId: 'user-1',
      nextUserId: 'user-2',
    });
  });
});
