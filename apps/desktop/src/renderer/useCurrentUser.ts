import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listUsersByLastSeen, upsertUser } from '@tinker/memory';
import type { SSOSession, SSOStatus, User } from '@tinker/shared-types';
import { DEFAULT_USER_ID, restoreAuthSession, type AuthProvider, type AuthStatus } from '../bindings.js';

const SESSION_REFRESH_SKEW_MS = 30_000;

export type ResolvedCurrentUserState =
  | {
      authState: 'authenticated';
      sessions: SSOStatus;
      user: User;
    }
  | {
      authState: 'unauthenticated';
      sessions: SSOStatus;
      user: null;
    };

export type CurrentUserState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & ResolvedCurrentUserState);

type ResolveCurrentUserDeps = {
  listUsersByLastSeen: () => Promise<User[]>;
  now?: () => number;
  readAuthStatus: () => Promise<SSOStatus>;
  restoreAuthSession: (provider: AuthProvider, userId: string) => Promise<SSOSession | null>;
  upsertUser: (user: User) => Promise<void>;
};

export const EMPTY_AUTH_STATUS: SSOStatus = {
  google: null,
  github: null,
  microsoft: null,
};

export const buildStoredUserId = (provider: User['provider'], providerUserId: string): string => {
  return `${provider}:${providerUserId}`;
};

export const createLocalUser = (timestamp: string = new Date().toISOString()): User => {
  return {
    id: DEFAULT_USER_ID,
    provider: 'local',
    providerUserId: DEFAULT_USER_ID,
    displayName: 'Offline mode',
    createdAt: timestamp,
    lastSeenAt: timestamp,
  };
};

export const toStoredUser = (session: SSOSession, timestamp: string = new Date().toISOString()): User => {
  return {
    id: buildStoredUserId(session.provider, session.userId),
    provider: session.provider,
    providerUserId: session.userId,
    displayName: session.displayName,
    email: session.email,
    createdAt: timestamp,
    lastSeenAt: timestamp,
    ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
  };
};

export const withDefaultSessions = (status: Partial<SSOStatus> | null | undefined): SSOStatus => {
  return {
    google: status?.google ?? null,
    github: status?.github ?? null,
    microsoft: status?.microsoft ?? null,
  };
};

const isRemoteUser = (user: User): user is User & { provider: AuthProvider } => {
  return user.provider !== 'local';
};

const getSessionForUser = (sessions: SSOStatus, user: User & { provider: AuthProvider }): SSOSession | null => {
  const session = sessions[user.provider];
  if (!session || session.userId !== user.providerUserId) {
    return null;
  }

  return session;
};

export const shouldAttemptSilentRestore = (session: SSOSession, now = Date.now()): boolean => {
  if (session.refreshToken.trim().length === 0) {
    return false;
  }

  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now + SESSION_REFRESH_SKEW_MS;
};

const orderedSessions = (sessions: SSOStatus): SSOSession[] => {
  return [sessions.google, sessions.github, sessions.microsoft].filter((session): session is SSOSession => session !== null);
};

const readAuthStatus = async (): Promise<SSOStatus> => {
  return withDefaultSessions(await invoke<AuthStatus>('auth_status'));
};

const readRestoredState = async (
  restore: () => Promise<SSOSession | null>,
  readStatus: () => Promise<SSOStatus>,
  storeUser: (user: User) => Promise<void>,
  timestamp: string,
): Promise<ResolvedCurrentUserState | null> => {
  const restored = await restore();
  if (!restored) {
    return null;
  }

  const user = toStoredUser(restored, timestamp);
  await storeUser(user);

  return {
    authState: 'authenticated',
    sessions: await readStatus(),
    user,
  };
};

export const resolveCurrentUser = async ({
  listUsersByLastSeen,
  now = () => Date.now(),
  readAuthStatus,
  restoreAuthSession,
  upsertUser,
}: ResolveCurrentUserDeps): Promise<ResolvedCurrentUserState> => {
  const nowMs = now();
  const timestamp = new Date(nowMs).toISOString();

  await upsertUser(createLocalUser(timestamp));

  const [users, sessions] = await Promise.all([listUsersByLastSeen(), readAuthStatus()]);

  for (const user of users) {
    if (!isRemoteUser(user)) {
      continue;
    }

    const session = getSessionForUser(sessions, user);
    if (session && !shouldAttemptSilentRestore(session, nowMs)) {
      return {
        authState: 'authenticated',
        sessions,
        user,
      };
    }

    const restoredState = await readRestoredState(
      () => restoreAuthSession(user.provider, user.providerUserId),
      readAuthStatus,
      upsertUser,
      timestamp,
    );
    if (restoredState) {
      return restoredState;
    }
  }

  for (const session of orderedSessions(sessions)) {
    if (!shouldAttemptSilentRestore(session, nowMs)) {
      const user = toStoredUser(session, timestamp);
      await upsertUser(user);
      return {
        authState: 'authenticated',
        sessions,
        user,
      };
    }

    const restoredState = await readRestoredState(
      () => restoreAuthSession(session.provider, session.userId),
      readAuthStatus,
      upsertUser,
      timestamp,
    );
    if (restoredState) {
      return restoredState;
    }
  }

  return {
    authState: 'unauthenticated',
    sessions,
    user: null,
  };
};

export const useCurrentUser = (nativeRuntime: boolean): {
  refresh: () => Promise<ResolvedCurrentUserState>;
  state: CurrentUserState;
} => {
  const mountedRef = useRef(true);
  const [state, setState] = useState<CurrentUserState>(() =>
    nativeRuntime
      ? { status: 'loading' }
      : { status: 'ready', authState: 'unauthenticated', sessions: EMPTY_AUTH_STATUS, user: null },
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<ResolvedCurrentUserState> => {
    if (!nativeRuntime) {
      const nextState: ResolvedCurrentUserState = {
        authState: 'unauthenticated',
        sessions: EMPTY_AUTH_STATUS,
        user: null,
      };
      if (mountedRef.current) {
        setState({ status: 'ready', ...nextState });
      }
      return nextState;
    }

    const nextState = await resolveCurrentUser({
      listUsersByLastSeen,
      readAuthStatus,
      restoreAuthSession,
      upsertUser,
    });

    if (mountedRef.current) {
      setState({ status: 'ready', ...nextState });
    }

    return nextState;
  }, [nativeRuntime]);

  useEffect(() => {
    let cancelled = false;

    if (!nativeRuntime) {
      setState({ status: 'ready', authState: 'unauthenticated', sessions: EMPTY_AUTH_STATUS, user: null });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const nextState = await resolveCurrentUser({
          listUsersByLastSeen,
          readAuthStatus,
          restoreAuthSession,
          upsertUser,
        });
        if (!cancelled) {
          setState({ status: 'ready', ...nextState });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nativeRuntime]);

  return {
    refresh,
    state,
  };
};
