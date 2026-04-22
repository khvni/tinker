import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDataDir, mockJoin, mockMkdir } = vi.hoisted(() => ({
  mockDataDir: vi.fn<() => Promise<string>>(),
  mockJoin: vi.fn<(...paths: string[]) => Promise<string>>(),
  mockMkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  dataDir: mockDataDir,
  join: mockJoin,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: mockMkdir,
}));

import {
  defaultMemoryRootSegments,
  detectMemoryRootPlatform,
  ensureDefaultMemoryRoot,
  resolveDefaultMemoryRoot,
} from './memory-paths.js';

const stubProcessPlatform = (platform: NodeJS.Platform): void => {
  vi.stubGlobal('process', { ...process, platform });
};

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
    mockDataDir.mockReset();
    mockJoin.mockReset();
    mockMkdir.mockReset();
    vi.unstubAllGlobals();
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
});
