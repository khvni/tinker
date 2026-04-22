import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EXA_HEALTH_TIMEOUT_MESSAGE,
  GITHUB_MCP_NAME,
  GITHUB_RECONNECT_MESSAGE,
  LINEAR_MCP_NAME,
  checkExaBootHealth,
  checkTrackedMcpBootHealth,
  githubSessionNeedsReconnect,
  normalizeExaBootStatus,
  resolveTrackedMcpStatuses,
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

describe('githubSessionNeedsReconnect', () => {
  it('requires reconnect when GitHub session lacks repo scopes', () => {
    expect(
      githubSessionNeedsReconnect({
        provider: 'github',
        userId: 'octo',
        email: 'octo@example.com',
        displayName: 'Octo',
        accessToken: 'token',
        refreshToken: '',
        expiresAt: '2026-04-22T00:00:00.000Z',
        scopes: ['read:user', 'user:email'],
      }),
    ).toBe(true);
  });

  it('accepts repo or public_repo scope', () => {
    expect(
      githubSessionNeedsReconnect({
        provider: 'github',
        userId: 'octo',
        email: 'octo@example.com',
        displayName: 'Octo',
        accessToken: 'token',
        refreshToken: '',
        expiresAt: '2026-04-22T00:00:00.000Z',
        scopes: ['repo'],
      }),
    ).toBe(false);
    expect(
      githubSessionNeedsReconnect({
        provider: 'github',
        userId: 'octo',
        email: 'octo@example.com',
        displayName: 'Octo',
        accessToken: 'token',
        refreshToken: '',
        expiresAt: '2026-04-22T00:00:00.000Z',
        scopes: ['public_repo'],
      }),
    ).toBe(false);
  });
});

describe('resolveTrackedMcpStatuses', () => {
  it('overrides GitHub to needs_auth when the signed-in session lacks repo scopes', () => {
    expect(
      resolveTrackedMcpStatuses(
        {
          exa: { status: 'connected' },
          github: { status: 'connected' },
          linear: { status: 'needs_auth' },
        },
        {
          provider: 'github',
          userId: 'octo',
          email: 'octo@example.com',
          displayName: 'Octo',
          accessToken: 'token',
          refreshToken: '',
          expiresAt: '2026-04-22T00:00:00.000Z',
          scopes: ['read:user', 'user:email'],
        },
      ),
    ).toEqual({
      exa: { status: 'connected' },
      github: { status: 'needs_auth', error: GITHUB_RECONNECT_MESSAGE },
      linear: { status: 'needs_auth' },
    });
  });
});

describe('checkTrackedMcpBootHealth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes tracked statuses from one MCP status call', async () => {
    await expect(
      checkTrackedMcpBootHealth(async () => ({
        data: {
          exa: { status: 'connected' },
          github: { status: 'connected' },
          linear: { status: 'needs_auth' },
        },
      }), null),
    ).resolves.toEqual({
      exa: { status: 'connected' },
      github: { status: 'connected' },
      linear: { status: 'needs_auth' },
    });
  });

  it('returns an error for every tracked MCP when the SDK returns a top-level error', async () => {
    await expect(
      checkTrackedMcpBootHealth(async () => ({
        data: undefined,
        error: 'remote MCP handshake failed',
      }), null),
    ).resolves.toEqual({
      exa: { status: 'error', error: 'remote MCP handshake failed' },
      [GITHUB_MCP_NAME]: { status: 'error', error: 'remote MCP handshake failed' },
      [LINEAR_MCP_NAME]: { status: 'error', error: 'remote MCP handshake failed' },
    });
  });
});
