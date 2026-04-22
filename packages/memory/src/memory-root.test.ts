import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDataDir, mockJoin, mockExists, mockMkdir } = vi.hoisted(() => ({
  mockDataDir: vi.fn<() => Promise<string>>(),
  mockJoin: vi.fn<(...paths: string[]) => Promise<string>>(),
  mockExists: vi.fn<(path: string) => Promise<boolean>>(),
  mockMkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  dataDir: mockDataDir,
  join: mockJoin,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: mockExists,
  mkdir: mockMkdir,
}));

import {
  defaultMemoryRootSegments,
  detectMemoryRootPlatform,
  ensureDefaultMemoryRoot,
  resolveDefaultMemoryRoot,
} from './memory-root.js';

describe('detectMemoryRootPlatform', () => {
  it('detects macOS from Application Support path', () => {
    expect(detectMemoryRootPlatform('/Users/alice/Library/Application Support')).toBe('macos');
  });

  it('detects Windows from roaming AppData path', () => {
    expect(detectMemoryRootPlatform('C:\\Users\\Alice\\AppData\\Roaming')).toBe('windows');
  });

  it('defaults to linux for XDG-style data paths', () => {
    expect(detectMemoryRootPlatform('/home/alice/.local/share')).toBe('linux');
    expect(detectMemoryRootPlatform('/var/lib/custom-data-home')).toBe('linux');
  });
});

describe('defaultMemoryRootSegments', () => {
  it('uses lowercase app directory on linux', () => {
    expect(defaultMemoryRootSegments('/home/alice/.local/share')).toEqual(['tinker', 'memory']);
  });

  it('uses title case app directory on macOS and Windows', () => {
    expect(defaultMemoryRootSegments('/Users/alice/Library/Application Support')).toEqual(['Tinker', 'memory']);
    expect(defaultMemoryRootSegments('C:\\Users\\Alice\\AppData\\Roaming')).toEqual(['Tinker', 'memory']);
  });
});

describe('default memory root resolution', () => {
  beforeEach(() => {
    mockDataDir.mockReset();
    mockJoin.mockReset();
    mockExists.mockReset();
    mockMkdir.mockReset();
  });

  it('resolves the linux default root under ~/.local/share/tinker/memory', async () => {
    mockDataDir.mockResolvedValue('/home/alice/.local/share');
    mockJoin.mockResolvedValue('/home/alice/.local/share/tinker/memory');

    await expect(resolveDefaultMemoryRoot()).resolves.toBe('/home/alice/.local/share/tinker/memory');
    expect(mockJoin).toHaveBeenCalledWith('/home/alice/.local/share', 'tinker', 'memory');
  });

  it('resolves the macOS default root under ~/Library/Application Support/Tinker/memory', async () => {
    mockDataDir.mockResolvedValue('/Users/alice/Library/Application Support');
    mockJoin.mockResolvedValue('/Users/alice/Library/Application Support/Tinker/memory');

    await expect(resolveDefaultMemoryRoot()).resolves.toBe('/Users/alice/Library/Application Support/Tinker/memory');
    expect(mockJoin).toHaveBeenCalledWith('/Users/alice/Library/Application Support', 'Tinker', 'memory');
  });

  it('resolves the Windows default root under %APPDATA%/Tinker/memory', async () => {
    mockDataDir.mockResolvedValue('C:\\Users\\Alice\\AppData\\Roaming');
    mockJoin.mockResolvedValue('C:\\Users\\Alice\\AppData\\Roaming\\Tinker\\memory');

    await expect(resolveDefaultMemoryRoot()).resolves.toBe('C:\\Users\\Alice\\AppData\\Roaming\\Tinker\\memory');
    expect(mockJoin).toHaveBeenCalledWith('C:\\Users\\Alice\\AppData\\Roaming', 'Tinker', 'memory');
  });

  it('creates the directory recursively when missing', async () => {
    mockDataDir.mockResolvedValue('/home/alice/.local/share');
    mockJoin.mockResolvedValue('/home/alice/.local/share/tinker/memory');
    mockExists.mockResolvedValue(false);
    mockMkdir.mockResolvedValue();

    await expect(ensureDefaultMemoryRoot()).resolves.toBe('/home/alice/.local/share/tinker/memory');
    expect(mockExists).toHaveBeenCalledWith('/home/alice/.local/share/tinker/memory');
    expect(mockMkdir).toHaveBeenCalledWith('/home/alice/.local/share/tinker/memory', { recursive: true });
  });

  it('returns the existing directory without creating it again', async () => {
    mockDataDir.mockResolvedValue('/home/alice/.local/share');
    mockJoin.mockResolvedValue('/home/alice/.local/share/tinker/memory');
    mockExists.mockResolvedValue(true);

    await expect(ensureDefaultMemoryRoot()).resolves.toBe('/home/alice/.local/share/tinker/memory');
    expect(mockMkdir).not.toHaveBeenCalled();
  });
});
