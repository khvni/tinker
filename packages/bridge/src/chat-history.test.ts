import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from '@opencode-ai/sdk/v2/client';

const {
  mockExists,
  mockMkdir,
  mockReadDir,
  mockReadTextFile,
  mockStat,
  mockWriteTextFile,
} = vi.hoisted(() => ({
  mockExists: vi.fn<(path: string) => Promise<boolean>>(),
  mockMkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
  mockReadDir: vi.fn<
    (path: string) => Promise<Array<{ name?: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }>>
  >(),
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockStat: vi.fn<(path: string) => Promise<{ mtime?: Date }>>(),
  mockWriteTextFile: vi.fn<
    (path: string, contents: string, options?: { append?: boolean; create?: boolean }) => Promise<void>
  >(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: mockExists,
  mkdir: mockMkdir,
  readDir: mockReadDir,
  readTextFile: mockReadTextFile,
  stat: mockStat,
  writeTextFile: mockWriteTextFile,
}));

import {
  buildChatHistoryPath,
  createChatHistoryWriter,
  findLatestChatHistorySessionId,
  parseChatHistoryText,
  readChatHistory,
  type StoredChatEvent,
} from './chat-history.js';

const makeEvent = (type: string, properties: Record<string, unknown>): Event => {
  return {
    type,
    properties,
  } as unknown as Event;
};

const makeRecord = (overrides: Partial<StoredChatEvent> = {}): StoredChatEvent => ({
  ts: '2026-04-22T07:00:00.000Z',
  event: 'message.part.delta',
  data: { sessionID: 'session-1', partID: 'part-1', delta: 'hello' },
  ...overrides,
});

describe('parseChatHistoryText', () => {
  it('dedupes exact duplicate lines and ignores a malformed trailing line', () => {
    const first = JSON.stringify(makeRecord());
    const text = `${first}\n${first}\n{"broken"`;

    expect(parseChatHistoryText(text)).toEqual([makeRecord()]);
  });
});

describe('readChatHistory', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockReadTextFile.mockReset();
  });

  it('returns an empty list when the file is absent', async () => {
    mockExists.mockResolvedValue(false);

    await expect(
      readChatHistory({
        folderPath: '/vault/project',
        userId: 'user-1',
        sessionId: 'session-1',
      }),
    ).resolves.toEqual([]);
  });

  it('reads and parses stored JSONL when the file exists', async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(`${JSON.stringify(makeRecord())}\n`);

    await expect(
      readChatHistory({
        folderPath: '/vault/project',
        userId: 'user-1',
        sessionId: 'session-1',
      }),
    ).resolves.toEqual([makeRecord()]);
  });
});

describe('createChatHistoryWriter', () => {
  beforeEach(() => {
    mockMkdir.mockReset();
    mockWriteTextFile.mockReset();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteTextFile.mockResolvedValue(undefined);
  });

  it('creates parent directories once and appends one JSON line per event', async () => {
    const writer = createChatHistoryWriter({
      folderPath: '/vault/project',
      userId: 'user-1',
      sessionId: 'session-1',
      now: () => '2026-04-22T07:00:00.000Z',
    });

    writer.appendEvent(makeEvent('message.part.delta', { sessionID: 'session-1', partID: 'part-1', delta: 'hi' }));
    writer.appendEvent(makeEvent('session.idle', { sessionID: 'session-1' }));

    await writer.flush();

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith('/vault/project/.tinker/chats/user-1', { recursive: true });
    expect(mockWriteTextFile).toHaveBeenCalledTimes(2);
    expect(mockWriteTextFile).toHaveBeenNthCalledWith(
      1,
      buildChatHistoryPath({
        folderPath: '/vault/project',
        userId: 'user-1',
        sessionId: 'session-1',
      }),
      `${JSON.stringify({
        ts: '2026-04-22T07:00:00.000Z',
        event: 'message.part.delta',
        data: { sessionID: 'session-1', partID: 'part-1', delta: 'hi' },
      })}\n`,
      { append: true, create: true },
    );
  });

  it('serializes writes through a single async queue', async () => {
    const steps: string[] = [];
    let releaseFirstWritePromise!: () => void;
    const firstWritePromise = new Promise<void>((resolve) => {
      releaseFirstWritePromise = resolve;
    });

    mockWriteTextFile
      .mockImplementationOnce(
        async () => {
          steps.push('first-start');
          await firstWritePromise;
          steps.push('first-end');
        },
      )
      .mockImplementationOnce(async () => {
        steps.push('second-start');
        steps.push('second-end');
      });

    const writer = createChatHistoryWriter({
      folderPath: '/vault/project',
      userId: 'user-1',
      sessionId: 'session-1',
    });

    writer.appendRecord(makeRecord({ event: 'first' }));
    writer.appendRecord(makeRecord({ event: 'second' }));

    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
    expect(steps).toEqual(['first-start']);

    releaseFirstWritePromise();
    await writer.flush();

    expect(steps).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it("logs write failures without stalling later writes", async () => {
    const logger = vi.fn<(message: string, error: unknown) => void>();

    mockWriteTextFile
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);

    const writer = createChatHistoryWriter({
      folderPath: '/vault/project',
      userId: 'user-1',
      sessionId: 'session-1',
      logger,
    });

    writer.appendRecord(makeRecord({ event: 'first' }));
    writer.appendRecord(makeRecord({ event: 'second' }));

    await writer.flush();

    expect(logger).toHaveBeenCalledTimes(1);
    expect(mockWriteTextFile).toHaveBeenCalledTimes(2);
  });
});

describe('findLatestChatHistorySessionId', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockReadDir.mockReset();
    mockStat.mockReset();
  });

  it('returns newest jsonl session id in the user history directory', async () => {
    mockExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([
      { name: 'session-old.jsonl', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'session-new.jsonl', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'notes.md', isDirectory: false, isFile: true, isSymlink: false },
    ]);
    mockStat.mockImplementation(async (path) => ({
      mtime: path.endsWith('session-new.jsonl') ? new Date('2026-04-22T08:00:00.000Z') : new Date('2026-04-22T07:00:00.000Z'),
    }));

    await expect(
      findLatestChatHistorySessionId({
        folderPath: '/vault/project',
        userId: 'user-1',
      }),
    ).resolves.toBe('session-new');
  });
});
