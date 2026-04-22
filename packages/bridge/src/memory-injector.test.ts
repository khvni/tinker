import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockReadDir,
  mockReadTextFile,
  mockStat,
} = vi.hoisted(() => ({
  mockReadDir: vi.fn<
    (path: string) => Promise<Array<{ name?: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }>>
  >(),
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockStat: vi.fn<(path: string) => Promise<{ mtime?: Date; size?: number }>>(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: mockReadDir,
  readTextFile: mockReadTextFile,
  stat: mockStat,
}));

import { buildMemoryContext, injectMemoryContext, readRecentMemoryFiles } from './memory-injector.js';

const createFileEntry = (name: string) => ({
  name,
  isDirectory: false,
  isFile: true,
  isSymlink: false,
});

describe('buildMemoryContext', () => {
  it('returns null when the file list is empty', () => {
    expect(buildMemoryContext([])).toBeNull();
  });

  it('renders file names and verbatim markdown bodies', () => {
    const text = buildMemoryContext([
      {
        name: 'profile.md',
        path: '/memory/profile.md',
        modifiedAt: 0,
        text: '# Profile\n\nOwns launch checklist.',
      },
    ]);

    expect(text).not.toBeNull();
    expect(text).toContain('## profile.md');
    expect(text).toContain('# Profile');
    expect(text).toContain('Owns launch checklist.');
  });
});

describe('readRecentMemoryFiles', () => {
  beforeEach(() => {
    mockReadDir.mockReset();
    mockReadTextFile.mockReset();
    mockStat.mockReset();
  });

  it('keeps the five newest markdown files and excludes the oldest sixth file', async () => {
    mockReadDir.mockResolvedValue([
      createFileEntry('memory-1.md'),
      createFileEntry('memory-2.md'),
      createFileEntry('memory-3.md'),
      createFileEntry('memory-4.md'),
      createFileEntry('memory-5.md'),
      createFileEntry('memory-6.md'),
    ]);
    mockStat.mockImplementation(async (path) => {
      const fileNumber = Number.parseInt(path.match(/memory-(\d)\.md$/u)?.[1] ?? '0', 10);
      return {
        mtime: new Date(`2026-04-22T0${fileNumber}:00:00.000Z`),
        size: 32,
      };
    });
    mockReadTextFile.mockImplementation(async (path) => `Contents for ${path}`);

    const files = await readRecentMemoryFiles('/memory');

    expect(files).toHaveLength(5);
    expect(files.map((file) => file.name)).toEqual([
      'memory-6.md',
      'memory-5.md',
      'memory-4.md',
      'memory-3.md',
      'memory-2.md',
    ]);
  });

  it('skips files larger than 100KB and logs a warning', async () => {
    const logger = vi.fn();
    mockReadDir.mockResolvedValue([createFileEntry('too-large.md'), createFileEntry('fits.md')]);
    mockStat.mockImplementation(async (path) => ({
      mtime: new Date('2026-04-22T00:00:00.000Z'),
      size: path.endsWith('too-large.md') ? 100 * 1024 + 1 : 64,
    }));
    mockReadTextFile.mockResolvedValue('ok');

    const files = await readRecentMemoryFiles('/memory', logger);

    expect(files.map((file) => file.name)).toEqual(['fits.md']);
    expect(logger).toHaveBeenCalledWith('Skipping memory file "/memory/too-large.md" because it exceeds 100KB.');
  });
});

describe('injectMemoryContext', () => {
  beforeEach(() => {
    mockReadDir.mockReset();
    mockReadTextFile.mockReset();
    mockStat.mockReset();
  });

  it('sends rendered memory as a noReply prompt on every prompt attempt', async () => {
    mockReadDir.mockResolvedValue([createFileEntry('profile.md')]);
    mockReadTextFile.mockResolvedValue('# Profile');
    mockStat.mockResolvedValue({
      mtime: new Date('2026-04-22T00:00:00.000Z'),
      size: 24,
    });
    const session = { prompt: vi.fn().mockResolvedValue(undefined) };

    await injectMemoryContext({ session } as never, 'session-1', {
      memoryDirectory: '/memory',
    });

    expect(session.prompt).toHaveBeenCalledTimes(1);
    const call = session.prompt.mock.calls[0]?.[0] as {
      sessionID: string;
      noReply: boolean;
      parts: Array<{ text: string }>;
    };
    expect(call.sessionID).toBe('session-1');
    expect(call.noReply).toBe(true);
    expect(call.parts[0]?.text).toContain('Relevant local memory:');
    expect(call.parts[0]?.text).toContain('## profile.md');
  });
});
