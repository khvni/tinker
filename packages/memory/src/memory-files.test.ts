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

import { listCategorisedMemoryFiles, listMemoryMarkdownFiles } from './memory-files.js';

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

describe('listCategorisedMemoryFiles', () => {
  beforeEach(() => {
    mockGetActiveMemoryPath.mockReset();
    mockReadDir.mockReset();
    mockStat.mockReset();

    mockGetActiveMemoryPath.mockResolvedValue('/memory/google:42');
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/memory/google:42') {
        return [
          createDirEntry('pending', 'directory'),
          createDirEntry('people', 'directory'),
          createDirEntry('active-work', 'directory'),
          createDirEntry('sessions', 'directory'),
          createDirEntry('profile.md', 'file'),
        ];
      }
      if (path === '/memory/google:42/pending') {
        return [
          createDirEntry('new-person.md', 'file'),
          createDirEntry('loose-note.md', 'file'),
        ];
      }
      if (path === '/memory/google:42/people') {
        return [createDirEntry('khani.md', 'file')];
      }
      if (path === '/memory/google:42/active-work') {
        return [createDirEntry('ship-tin-196.md', 'file')];
      }
      if (path === '/memory/google:42/sessions') {
        return [createDirEntry('2026-04-22-session.md', 'file')];
      }
      return [];
    });
    mockStat.mockImplementation(async (path: string) => {
      if (path.endsWith('new-person.md')) {
        return { mtime: new Date('2026-04-22T14:00:00.000Z') };
      }
      if (path.endsWith('loose-note.md')) {
        return { mtime: new Date('2026-04-22T12:00:00.000Z') };
      }
      if (path.endsWith('khani.md')) {
        return { mtime: new Date('2026-04-21T08:00:00.000Z') };
      }
      if (path.endsWith('ship-tin-196.md')) {
        return { mtime: new Date('2026-04-22T09:00:00.000Z') };
      }
      if (path.endsWith('2026-04-22-session.md')) {
        return { mtime: new Date('2026-04-22T11:00:00.000Z') };
      }
      if (path.endsWith('profile.md')) {
        return { mtime: new Date('2026-04-20T12:00:00.000Z') };
      }
      return {};
    });
  });

  it('buckets files into pending + category sections newest-first and ignores uncategorised entries', async () => {
    const result = await listCategorisedMemoryFiles('google:42', 'darwin');

    expect(result.rootPath).toBe('/memory/google:42');
    expect(result.buckets.pending).toEqual([
      {
        absolutePath: '/memory/google:42/pending/new-person.md',
        relativePath: 'pending/new-person.md',
        name: 'new-person.md',
        modifiedAt: '2026-04-22T14:00:00.000Z',
      },
      {
        absolutePath: '/memory/google:42/pending/loose-note.md',
        relativePath: 'pending/loose-note.md',
        name: 'loose-note.md',
        modifiedAt: '2026-04-22T12:00:00.000Z',
      },
    ]);
    expect(result.buckets.people).toEqual([
      {
        absolutePath: '/memory/google:42/people/khani.md',
        relativePath: 'people/khani.md',
        name: 'khani.md',
        modifiedAt: '2026-04-21T08:00:00.000Z',
      },
    ]);
    expect(result.buckets['active-work']).toEqual([
      {
        absolutePath: '/memory/google:42/active-work/ship-tin-196.md',
        relativePath: 'active-work/ship-tin-196.md',
        name: 'ship-tin-196.md',
        modifiedAt: '2026-04-22T09:00:00.000Z',
      },
    ]);
    expect(result.buckets.capabilities).toEqual([]);
    expect(result.buckets.preferences).toEqual([]);
    expect(result.buckets.organization).toEqual([]);
  });

  it('returns empty buckets when the memory root has no matching directories', async () => {
    mockReadDir.mockImplementation(async (path: string) => {
      if (path === '/memory/google:42') {
        return [createDirEntry('notes', 'directory')];
      }
      if (path === '/memory/google:42/notes') {
        return [createDirEntry('draft.md', 'file')];
      }
      return [];
    });
    mockStat.mockResolvedValue({ mtime: new Date('2026-04-22T10:00:00.000Z') });

    const result = await listCategorisedMemoryFiles('google:42');

    expect(result.buckets.pending).toEqual([]);
    expect(result.buckets.people).toEqual([]);
    expect(result.buckets['active-work']).toEqual([]);
    expect(result.buckets.capabilities).toEqual([]);
    expect(result.buckets.preferences).toEqual([]);
    expect(result.buckets.organization).toEqual([]);
  });
});
