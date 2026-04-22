import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockJoin,
  mockMkdir,
  mockWriteTextFile,
} = vi.hoisted(() => ({
  mockJoin: vi.fn<(first: string, ...segments: string[]) => Promise<string>>(),
  mockMkdir: vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>(),
  mockWriteTextFile: vi.fn<
    (path: string, contents: string, options?: { append?: boolean; create?: boolean }) => Promise<void>
  >(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: mockJoin,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: mockMkdir,
  writeTextFile: mockWriteTextFile,
}));

const { mockGetMemoryAutoAppendEnabled } = vi.hoisted(() => ({
  mockGetMemoryAutoAppendEnabled: vi.fn<() => Promise<boolean>>(),
}));

vi.mock('./memory-settings.js', () => ({
  getMemoryAutoAppendEnabled: mockGetMemoryAutoAppendEnabled,
}));

import {
  appendMemoryCapture,
  buildMemoryCapturePath,
  formatMemoryCaptureFileStamp,
  renderMemoryCaptureEntry,
} from './memory-capture.js';

describe('memory capture helpers', () => {
  beforeEach(() => {
    mockJoin.mockReset();
    mockMkdir.mockReset();
    mockWriteTextFile.mockReset();
    mockGetMemoryAutoAppendEnabled.mockReset();

    mockJoin.mockImplementation(async (first, ...segments) => [first, ...segments].join('/'));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteTextFile.mockResolvedValue(undefined);
    mockGetMemoryAutoAppendEnabled.mockResolvedValue(true);
  });

  it('formats stable filenames from the session start timestamp', () => {
    expect(formatMemoryCaptureFileStamp('2026-04-22T09:54:21.000Z')).toBe('2026-04-22-0954');
  });

  it('builds the per-session markdown path inside sessions/', async () => {
    await expect(
      buildMemoryCapturePath('/memory/google:user-1', '2026-04-22T09:54:21.000Z', 'session-1'),
    ).resolves.toBe('/memory/google:user-1/sessions/2026-04-22-0954-session-1.md');
  });

  it('renders verbatim user and assistant sections', () => {
    expect(
      renderMemoryCaptureEntry({
        userPrompt: 'Summarize this repo.',
        assistantMessage: 'Summary goes here.',
        capturedAt: '2026-04-22T10:00:00.000Z',
      }),
    ).toContain('### User\nSummarize this repo.');
  });

  it('creates parent dirs once and appends instead of overwriting', async () => {
    await expect(
      appendMemoryCapture({
        memoryDirectory: '/memory/google:user-1',
        sessionCreatedAt: '2026-04-22T09:54:21.000Z',
        sessionId: 'session-1',
        userPrompt: 'Summarize this repo.',
        assistantMessage: 'Summary goes here.',
        capturedAt: '2026-04-22T10:00:00.000Z',
      }),
    ).resolves.toBe(true);

    expect(mockMkdir).toHaveBeenCalledWith('/memory/google:user-1/sessions', { recursive: true });
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      '/memory/google:user-1/sessions/2026-04-22-0954-session-1.md',
      expect.stringContaining('### Assistant\nSummary goes here.'),
      { append: true, create: true },
    );
  });

  it('skips writes when auto-capture is disabled', async () => {
    mockGetMemoryAutoAppendEnabled.mockResolvedValue(false);

    await expect(
      appendMemoryCapture({
        memoryDirectory: '/memory/google:user-1',
        sessionCreatedAt: '2026-04-22T09:54:21.000Z',
        sessionId: 'session-1',
        userPrompt: 'Summarize this repo.',
        assistantMessage: 'Summary goes here.',
      }),
    ).resolves.toBe(false);

    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it('logs failures and continues non-blocking', async () => {
    const logger = vi.fn();
    mockWriteTextFile.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      appendMemoryCapture({
        memoryDirectory: '/memory/google:user-1',
        sessionCreatedAt: '2026-04-22T09:54:21.000Z',
        sessionId: 'session-1',
        userPrompt: 'Summarize this repo.',
        assistantMessage: 'Summary goes here.',
        logger,
      }),
    ).resolves.toBe(false);

    expect(logger).toHaveBeenCalledOnce();
  });
});
