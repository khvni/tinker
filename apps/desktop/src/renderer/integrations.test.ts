import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EXA_HEALTH_TIMEOUT_MESSAGE,
  checkExaBootHealth,
  normalizeExaBootStatus,
} from './integrations.js';

describe('normalizeExaBootStatus', () => {
  it('reports connected when exa is connected', () => {
    expect(normalizeExaBootStatus({ status: 'connected' })).toEqual({ status: 'connected' });
  });

  it('turns non-connected states into an error', () => {
    expect(normalizeExaBootStatus({ status: 'failed', error: 'dial tcp timeout' })).toEqual({
      status: 'error',
      error: 'dial tcp timeout',
    });
  });

  it('reports a descriptive error when exa is missing', () => {
    expect(normalizeExaBootStatus(undefined)).toEqual({
      status: 'error',
      error: 'Exa did not report a connection status.',
    });
  });
});

describe('checkExaBootHealth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns connected when the status call succeeds', async () => {
    await expect(
      checkExaBootHealth(async () => ({
        data: {
          exa: { status: 'connected' },
        },
      })),
    ).resolves.toEqual({ status: 'connected' });
  });

  it('surfaces top-level SDK errors when the status call resolves without data', async () => {
    await expect(
      checkExaBootHealth(async () => ({
        data: undefined,
        error: 'remote MCP handshake failed',
      })),
    ).resolves.toEqual({
      status: 'error',
      error: 'remote MCP handshake failed',
    });
  });

  it('times out after 5 seconds and returns an error message', async () => {
    vi.useFakeTimers();

    const result = checkExaBootHealth(
      () =>
        new Promise(() => {
          // Intentionally never resolves.
        }),
    );

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toEqual({
      status: 'error',
      error: EXA_HEALTH_TIMEOUT_MESSAGE,
    });
  });
});
