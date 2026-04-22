import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetActiveMemoryPath, mockReadDir, mockStat } = vi.hoisted(() => ({
  mockGetActiveMemoryPath: vi.fn<(userId: string, runtimePlatform?: string) => Promise<string>>(),
  mockReadDir: vi.fn<
    (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }>>
  >(),
  mockStat: vi.fn<(path: string) => Promise<{ mtime?: Date }>>(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: mockReadDir,
  stat: mockStat,
}));

vi.mock('./memory-paths.js', () => ({
  getActiveMemoryPath: mockGetActiveMemoryPath,
}));

import { listMemoryMarkdownFiles } from './memory-files.js';

const createDirEntry = (name: string, kind: 'directory' | 'file') => ({
  name,
  isDirectory: kind === 'directory',
  isFile: kind === 'file',
  isSymlink: false,
});

describe('listMemoryMarkdownFiles', () => {
  beforeEach(() => {
    mockGetActiveMemoryPath.mockReset();
    mockReadDir.mockReset();
    mockStat.mockReset();

    mockGetActiveMemoryPath.mockResolvedValue('/memory/google:42');
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/memory/google:42') {
        return [
          createDirEntry('profile.md', 'file'),
          createDirEntry('ideas.txt', 'file'),
          createDirEntry('sessions', 'directory'),
        ];
      }

      if (path === '/memory/google:42/sessions') {
        return [createDirEntry('2026-04-22-1000-session.md', 'file')];
      }

      return [];
    });
    mockStat.mockImplementation(async (path: string) => {
      if (path.endsWith('profile.md')) {
        return { mtime: new Date('2026-04-21T12:00:00.000Z') };
      }

      if (path.endsWith('2026-04-22-1000-session.md')) {
        return { mtime: new Date('2026-04-22T10:00:00.000Z') };
      }

      return {};
    });
  });

  it('lists markdown files from the active memory path newest-first', async () => {
    await expect(listMemoryMarkdownFiles('google:42', 'darwin')).resolves.toEqual([
      {
        absolutePath: '/memory/google:42/sessions/2026-04-22-1000-session.md',
        relativePath: 'sessions/2026-04-22-1000-session.md',
        name: '2026-04-22-1000-session.md',
        modifiedAt: '2026-04-22T10:00:00.000Z',
      },
      {
        absolutePath: '/memory/google:42/profile.md',
        relativePath: 'profile.md',
        name: 'profile.md',
        modifiedAt: '2026-04-21T12:00:00.000Z',
      },
    ]);

    expect(mockGetActiveMemoryPath).toHaveBeenCalledWith('google:42', 'darwin');
    expect(mockReadDir).toHaveBeenCalledWith('/memory/google:42');
    expect(mockReadDir).toHaveBeenCalledWith('/memory/google:42/sessions');
    expect(mockStat).toHaveBeenCalledWith('/memory/google:42/profile.md');
    expect(mockStat).toHaveBeenCalledWith('/memory/google:42/sessions/2026-04-22-1000-session.md');
  });

  it('breaks identical timestamps by relative path', async () => {
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/memory/google:42') {
        return [createDirEntry('zeta.md', 'file'), createDirEntry('alpha.md', 'file')];
      }

      return [];
    });
    mockStat.mockResolvedValue({ mtime: new Date('2026-04-22T10:00:00.000Z') });

    await expect(listMemoryMarkdownFiles('google:42')).resolves.toEqual([
      {
        absolutePath: '/memory/google:42/alpha.md',
        relativePath: 'alpha.md',
        name: 'alpha.md',
        modifiedAt: '2026-04-22T10:00:00.000Z',
      },
      {
        absolutePath: '/memory/google:42/zeta.md',
        relativePath: 'zeta.md',
        name: 'zeta.md',
        modifiedAt: '2026-04-22T10:00:00.000Z',
      },
    ]);
  });
});
