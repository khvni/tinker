import { describe, expect, it, vi } from 'vitest';
import type { SSOSession, SSOStatus, User } from '@tinker/shared-types';
import { resolveCurrentUser, shouldAttemptSilentRestore, toStoredUser } from './useCurrentUser.js';

const BASE_SESSION: SSOSession = {
  provider: 'google',
  userId: 'user-123',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://example.com/ada.png',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-04-23T00:00:00.000Z',
  scopes: ['openid', 'email', 'profile'],
};

const BASE_USER: User = {
  id: 'google:user-123',
  provider: 'google',
  providerUserId: 'user-123',
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://example.com/ada.png',
  email: 'ada@example.com',
  createdAt: '2026-04-21T00:00:00.000Z',
  lastSeenAt: '2026-04-22T00:00:00.000Z',
};

const EMPTY_STATUS: SSOStatus = {
  google: null,
  github: null,
  microsoft: null,
};

describe('shouldAttemptSilentRestore', () => {
  it('refreshes sessions with refresh tokens once they are near expiry', () => {
    expect(
      shouldAttemptSilentRestore(
        {
          ...BASE_SESSION,
          expiresAt: '2026-04-22T00:00:20.000Z',
        },
        Date.parse('2026-04-22T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('skips restore when provider never returned a refresh token', () => {
    expect(
      shouldAttemptSilentRestore(
        {
          ...BASE_SESSION,
          provider: 'github',
          refreshToken: '',
          expiresAt: '2026-04-22T00:00:00.000Z',
        },
        Date.parse('2026-04-22T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});

describe('resolveCurrentUser', () => {
  it('returns the most-recent known user when a fresh cached session exists', async () => {
    const upsertUser = vi.fn(async () => {});
    const restoreAuthSession = vi.fn(async () => null);

    await expect(
      resolveCurrentUser({
        listUsersByLastSeen: async () => [BASE_USER],
        now: () => Date.parse('2026-04-22T00:00:00.000Z'),
        readAuthStatus: async () => ({
          ...EMPTY_STATUS,
          google: BASE_SESSION,
        }),
        restoreAuthSession,
        upsertUser,
      }),
    ).resolves.toEqual({
      authState: 'authenticated',
      sessions: {
        ...EMPTY_STATUS,
        google: BASE_SESSION,
      },
      user: BASE_USER,
    });

    expect(restoreAuthSession).not.toHaveBeenCalled();
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'local-user',
        provider: 'local',
        providerUserId: 'local-user',
      }),
    );
  });

  it('restores the most-recent user when the cached session is expired', async () => {
    const restoredSession: SSOSession = {
      ...BASE_SESSION,
      accessToken: 'fresh-access-token',
      expiresAt: '2026-04-22T01:00:00.000Z',
    };
    const upsertUser = vi.fn(async () => {});
    const readAuthStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ...EMPTY_STATUS,
        google: {
          ...BASE_SESSION,
          expiresAt: '2026-04-21T23:59:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        ...EMPTY_STATUS,
        google: restoredSession,
      });

    const resolved = await resolveCurrentUser({
      listUsersByLastSeen: async () => [BASE_USER],
      now: () => Date.parse('2026-04-22T00:00:00.000Z'),
      readAuthStatus,
      restoreAuthSession: async () => restoredSession,
      upsertUser,
    });

    expect(resolved).toEqual({
      authState: 'authenticated',
      sessions: {
        ...EMPTY_STATUS,
        google: restoredSession,
      },
      user: expect.objectContaining({
        id: 'google:user-123',
        provider: 'google',
        providerUserId: 'user-123',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        avatarUrl: 'https://example.com/ada.png',
      }),
    });

    expect(upsertUser).toHaveBeenCalledWith(
      toStoredUser(restoredSession, '2026-04-22T00:00:00.000Z'),
    );
  });

  it('falls back to unauthenticated when no cached or restorable session exists', async () => {
    await expect(
      resolveCurrentUser({
        listUsersByLastSeen: async () => [BASE_USER],
        readAuthStatus: async () => EMPTY_STATUS,
        restoreAuthSession: async () => null,
        upsertUser: async () => {},
      }),
    ).resolves.toEqual({
      authState: 'unauthenticated',
      sessions: EMPTY_STATUS,
      user: null,
    });
  });
});
