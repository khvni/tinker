import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  createLayoutStore,
  createMemoryStore,
  createScheduledJobStore,
  createSkillStore,
  createVaultService,
  getActiveMemoryPath,
  indexVault,
  migrateLocalUserIdentity,
  subscribeMemoryPathChanged,
  syncActiveMemoryPath,
  upsertUser,
  type MemoryRunState,
} from '@tinker/memory';
import { createSchedulerEngine, type SchedulerEngine } from '@tinker/scheduler';
import type { LayoutStore, MemoryStore, ScheduledJobStore, SkillStore, SSOStatus, SSOSession, User } from '@tinker/shared-types';
import { GUEST_USER_ID, openFolderPicker, type AuthProvider, type AuthStatus, type OpencodeConnection, VAULT_PATH_KEY } from '../bindings.js';
import { readDailySweepState, runDailyMemorySweepIfDue } from './memory.js';
import {
  BUILTIN_MCP_NAMES,
  checkTrackedMcpBootHealth,
  EXA_CHECKING_STATUS,
  EXA_MCP_NAME,
  type MCPStatus,
} from './integrations.js';
import { createWorkspaceClient, getOpencodeDirectory, pickFirstOauthProvider } from './opencode.js';
import { isTauriRuntime } from './runtime.js';
import {
  buildStoredUserId,
  toStoredUser,
  useCurrentUser,
} from './useCurrentUser.js';
import { Workspace } from './workspace/Workspace.js';

type BindingKey = string;

const bindingKey = (folderPath: string, memorySubdir: string, userId: string): BindingKey =>
  `${folderPath}\0${memorySubdir}\0${userId}`;

const defaultConnection = (state: ReadyAppState): OpencodeConnection => {
  return state.opencodes[state.defaultBindingKey] ?? Object.values(state.opencodes)[0] ?? WEB_PREVIEW_CONNECTION;
};

const connectionFor = (state: ReadyAppState, key: BindingKey): OpencodeConnection =>
  state.opencodes[key] ?? defaultConnection(state);

type ReadyAppState = {
  status: 'ready';
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  skillStore: SkillStore;
  schedulerStore: ScheduledJobStore;
  opencodes: Record<BindingKey, OpencodeConnection>;
  defaultBindingKey: BindingKey;
  mcpStatus: Record<string, MCPStatus>;
  vaultPath: string | null;
  modelConnected: boolean;
  vaultRevision: number;
  activeSkillsRevision: number;
  schedulerRevision: number;
};

type AppState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ReadyAppState;

type ProviderBusyState = Record<AuthProvider, boolean>;
type ProviderMessageState = Record<AuthProvider, string | null>;
type CurrentUserState = {
  id: string;
  provider: User['provider'];
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};

const MODEL_CONNECT_POLL_INTERVAL_MS = 1_500;
const MODEL_CONNECT_TIMEOUT_MS = 180_000;
const VAULT_REINDEX_DEBOUNCE_MS = 300;
const EMPTY_PROVIDER_BUSY: ProviderBusyState = { google: false, github: false, microsoft: false };
const EMPTY_PROVIDER_MESSAGES: ProviderMessageState = { google: null, github: null, microsoft: null };
const WEB_PREVIEW_CONNECTION: OpencodeConnection = {
  baseUrl: 'http://127.0.0.1:0',
  username: 'preview',
  password: 'preview',
};

const providerDisplayName = (provider: AuthProvider): string => {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    case 'microsoft':
      return 'Microsoft';
  }
};

const providerNeedsRefreshToken = (provider: AuthProvider): boolean => {
  return provider === 'google' || provider === 'microsoft';
};

const providerNeedsWorkspaceRefresh = (provider: AuthProvider): boolean => {
  return provider === 'github';
};

const createGuestUser = (): User => {
  const timestamp = new Date().toISOString();

  return {
    id: GUEST_USER_ID,
    provider: 'local',
    providerUserId: GUEST_USER_ID,
    displayName: 'Guest',
    createdAt: timestamp,
    lastSeenAt: timestamp,
  };
};

const pickCurrentUserId = (sessions: SSOStatus): User['id'] => {
  const activeSession = sessions.google ?? sessions.github ?? sessions.microsoft;
  return activeSession
    ? buildStoredUserId(activeSession.provider, activeSession.userId)
    : GUEST_USER_ID;
};

const resolveCurrentUser = (sessions: SSOStatus): CurrentUserState => {
  const activeSession = sessions.google ?? sessions.github ?? sessions.microsoft;
  if (!activeSession) {
    return {
      id: GUEST_USER_ID,
      provider: 'local',
      displayName: 'Guest',
      email: null,
      avatarUrl: null,
    };
  }

  return {
    id: buildStoredUserId(activeSession.provider, activeSession.userId),
    provider: activeSession.provider,
    displayName: activeSession.displayName,
    email: activeSession.email,
    avatarUrl: activeSession.avatarUrl ?? null,
  };
};

const withDefaultSessions = (status: Partial<SSOStatus> | null | undefined): SSOStatus => {
  return {
    google: status?.google ?? null,
    github: status?.github ?? null,
    microsoft: status?.microsoft ?? null,
  };
};

const readAuthStatus = async (): Promise<SSOStatus> => {
  return withDefaultSessions(await invoke<AuthStatus>('auth_status'));
};

const syncStoredUsers = async (sessions: SSOStatus): Promise<void> => {
  const connectedSessions = Object.values(sessions).filter((session): session is SSOSession => session !== null);
  await Promise.all([
    upsertUser(createGuestUser()),
    ...connectedSessions.map((session) => upsertUser(toStoredUser(session))),
  ]);
};

const syncCurrentUserMemoryPath = async (
  sessions: SSOStatus,
  options?: { emit?: boolean },
): Promise<void> => {
  const connectedSessions = Object.values(sessions).filter((session): session is SSOSession => session !== null);
  await Promise.all(
    connectedSessions.map((session) => getActiveMemoryPath(buildStoredUserId(session.provider, session.userId))),
  );
  await syncActiveMemoryPath(pickCurrentUserId(sessions), options);
};

const selectSessionFolder = async (): Promise<string | null> => {
  const picked = await openFolderPicker();
  return picked.trim().length > 0 ? picked : null;
};

const forwardGoogleAuth = async (
  connection: OpencodeConnection,
  vaultPath: string | null,
  session: SSOSession,
): Promise<void> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const expires = Date.parse(session.expiresAt);
  if (Number.isNaN(expires)) {
    throw new Error('Stored Google session had an invalid expiration timestamp.');
  }

  await client.auth.set({
    providerID: 'google',
    auth: {
      type: 'oauth',
      access: session.accessToken,
      refresh: session.refreshToken,
      expires,
      accountId: session.userId,
    },
  });
};

const clearGoogleAuth = async (connection: OpencodeConnection, vaultPath: string | null): Promise<void> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  await client.auth.remove({ providerID: 'google' });
};

const syncConnectorState = async (
  connection: OpencodeConnection,
  vaultPath: string | null,
  sessions: SSOStatus,
): Promise<void> => {
  if (sessions.google) {
    await forwardGoogleAuth(connection, vaultPath, sessions.google);
  } else {
    try {
      await clearGoogleAuth(connection, vaultPath);
    } catch (error) {
      console.warn('Could not clear Google auth from OpenCode.', error);
    }
  }
};

const isModelConnected = async (connection: OpencodeConnection, vaultPath: string | null): Promise<boolean> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const response = await client.provider.list();
  return (response.data?.connected.length ?? 0) > 0;
};

const probeModelConnection = async (connection: OpencodeConnection, vaultPath: string | null): Promise<boolean> => {
  try {
    return await isModelConnected(connection, vaultPath);
  } catch (error) {
    console.warn('Could not determine whether an AI model is connected via OpenCode. Continuing disconnected.', error);
    return false;
  }
};

const waitForModelConnection = async (connection: OpencodeConnection, vaultPath: string | null): Promise<boolean> => {
  const deadline = Date.now() + MODEL_CONNECT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await isModelConnected(connection, vaultPath)) {
      return true;
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, MODEL_CONNECT_POLL_INTERVAL_MS);
    });
  }

  return false;
};

const connectModelProvider = async (connection: OpencodeConnection, vaultPath: string | null): Promise<void> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const [providersResponse, authResponse] = await Promise.all([client.provider.list(), client.provider.auth()]);
  const target = pickFirstOauthProvider(providersResponse.data?.all ?? [], authResponse.data ?? {});

  if (!target) {
    throw new Error('OpenCode did not expose an OAuth-capable AI provider.');
  }

  const authorizeResponse = await client.provider.oauth.authorize({
    providerID: target.providerId,
    method: target.methodIndex,
  });
  const authorization = authorizeResponse.data;

  if (!authorization?.url) {
    throw new Error(`OpenCode did not return an authorization URL for provider "${target.providerId}".`);
  }

  const authorizationUrl = new URL(authorization.url);
  if (authorizationUrl.protocol !== 'https:') {
    throw new Error(`OpenCode returned a non-HTTPS authorization URL for provider "${target.providerId}".`);
  }

  await openExternal(authorizationUrl.toString());

  if (!(await waitForModelConnection(connection, vaultPath))) {
    throw new Error(`OpenCode did not finish connecting provider "${target.providerId}" before authorization timed out.`);
  }
};

const disconnectModelProvider = async (connection: OpencodeConnection, vaultPath: string | null): Promise<void> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const [providersResponse, authResponse] = await Promise.all([client.provider.list(), client.provider.auth()]);
  const removableProviders = (providersResponse.data?.connected ?? []).filter((providerId) => providerId in (authResponse.data ?? {}));

  if (removableProviders.length === 0) {
    throw new Error('OpenCode did not expose a removable OAuth-backed model connection.');
  }

  for (const providerId of removableProviders) {
    await client.auth.remove({ providerID: providerId });
  }
};

export const App = (): JSX.Element => {
  const nativeRuntime = useMemo(() => isTauriRuntime(), []);
  const memoryStore = useMemo(() => createMemoryStore(), []);
  const layoutStore = useMemo(() => createLayoutStore(), []);
  const schedulerStore = useMemo(() => createScheduledJobStore(), []);
  const skillStore = useMemo(() => createSkillStore(), []);
  const vaultService = useMemo(() => createVaultService(), []);
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [modelAuthBusy, setModelAuthBusy] = useState(false);
  const [modelAuthMessage, setModelAuthMessage] = useState<string | null>(null);
  const [providerBusy, setProviderBusy] = useState<ProviderBusyState>(EMPTY_PROVIDER_BUSY);
  const [providerMessages, setProviderMessages] = useState<ProviderMessageState>(EMPTY_PROVIDER_MESSAGES);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestMessage, setGuestMessage] = useState<string | null>(null);
  const [memorySweepState, setMemorySweepState] = useState<MemoryRunState | null>(null);
  const [memorySweepBusy, setMemorySweepBusy] = useState(false);
  const [sessionFolderBusy, setSessionFolderBusy] = useState(false);
  const schedulerEngineRef = useRef<SchedulerEngine | null>(null);
  const refcountsRef = useRef<Record<BindingKey, number>>({});
  const { state: currentUserState, refresh: refreshCurrentUser } = useCurrentUser(nativeRuntime);

  useEffect(() => {
    const ready = state.status === 'ready' && currentUserState.status === 'ready';
    document.documentElement.dataset['appReady'] = ready ? 'true' : 'false';
  }, [state.status, currentUserState.status]);

  const requireNativeRuntime = (action: string): void => {
    if (!nativeRuntime) {
      throw new Error(`${action} is unavailable in browser preview. Use pnpm dev:desktop for native app flows.`);
    }
  };

  const bumpSchedulerRevision = (): void => {
    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            schedulerRevision: current.schedulerRevision + 1,
          },
    );
  };

  const setProviderBusyValue = (provider: AuthProvider, value: boolean): void => {
    setProviderBusy((current) => ({ ...current, [provider]: value }));
  };

  const setProviderMessage = (provider: AuthProvider, message: string | null): void => {
    setProviderMessages((current) => ({ ...current, [provider]: message }));
  };

  const acquireOpencode = useCallback(
    async (folderPath: string, memorySubdir: string, userId: string): Promise<OpencodeConnection> => {
      requireNativeRuntime('Acquiring OpenCode connection');
      const key = bindingKey(folderPath, memorySubdir, userId);
      const conn = await invoke<OpencodeConnection>('start_opencode', { folderPath, userId, memorySubdir });
      refcountsRef.current[key] = (refcountsRef.current[key] ?? 0) + 1;
      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              opencodes: { ...current.opencodes, [key]: conn },
            },
      );
      return conn;
    },
    [nativeRuntime],
  );

  const releaseOpencode = useCallback(
    async (folderPath: string, memorySubdir: string, userId: string): Promise<void> => {
      if (!nativeRuntime || state.status !== 'ready') return;
      const key = bindingKey(folderPath, memorySubdir, userId);
      const nextCount = (refcountsRef.current[key] ?? 1) - 1;
      refcountsRef.current[key] = nextCount;

      if (nextCount > 0 || key === state.defaultBindingKey) {
        return;
      }

      const conn = state.opencodes[key];
      if (!conn) return;

      await invoke('stop_opencode', { pid: conn.pid });
      setState((current) => {
        if (current.status !== 'ready') return current;
        const { [key]: _, ...rest } = current.opencodes;
        return { ...current, opencodes: rest };
      });
    },
    [nativeRuntime, state],
  );

  const refreshAllConnectorState = useCallback(
    async (sessions: SSOStatus): Promise<void> => {
      if (!nativeRuntime || state.status !== 'ready') {
        return;
      }
      await syncCurrentUserMemoryPath(sessions, { emit: false });
      for (const conn of Object.values(state.opencodes)) {
        await syncConnectorState(conn, state.vaultPath, sessions);
      }
      const modelConnected = await probeModelConnection(defaultConnection(state), state.vaultPath);
      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              modelConnected,
              mcpStatus: {
                ...current.mcpStatus,
                [EXA_MCP_NAME]: EXA_CHECKING_STATUS,
                ...Object.fromEntries(BUILTIN_MCP_NAMES.map((name) => [name, EXA_CHECKING_STATUS])),
              },
            },
      );
    },
    [nativeRuntime, state],
  );

  useEffect(() => {
    if (!nativeRuntime || state.status !== 'ready' || currentUserState.status !== 'ready') {
      return;
    }

    const sessions = currentUserState.sessions;

    return subscribeMemoryPathChanged((detail) => {
      if (detail.reason !== 'root-changed') {
        return;
      }

      void refreshAllConnectorState(sessions).catch((error) => {
        console.warn('Failed to refresh OpenCode after a memory path change.', error);
      });
    });
  }, [
    nativeRuntime,
    refreshAllConnectorState,
    state.status,
    currentUserState.status,
    currentUserState.status === 'ready' ? currentUserState.sessions : null,
  ]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!nativeRuntime) {
          if (!active) {
            return;
          }

          const previewKey = bindingKey('', '', 'preview');
          setState({
            status: 'ready',
            layoutStore,
            memoryStore,
            skillStore,
            schedulerStore,
            opencodes: { [previewKey]: WEB_PREVIEW_CONNECTION },
            defaultBindingKey: previewKey,
            mcpStatus: {},
            vaultPath: null,
            modelConnected: false,
            vaultRevision: 0,
            activeSkillsRevision: 0,
            schedulerRevision: 0,
          });
          return;
        }

        const sessions = await readAuthStatus();
        await migrateLocalUserIdentity('local-user', GUEST_USER_ID);
        await syncStoredUsers(sessions);
        await syncCurrentUserMemoryPath(sessions, { emit: false });
        const storedVaultPath = window.localStorage.getItem(VAULT_PATH_KEY);

        let vaultRevision = 0;
        if (storedVaultPath) {
          const config = { path: storedVaultPath, isNew: false };
          await vaultService.init(config);
          await indexVault(config);
          await skillStore.init(storedVaultPath);
          await skillStore.reindex();
          vaultRevision = 1;
        }

        const home = await homeDir();
        const guestMemoryPath = await getActiveMemoryPath(GUEST_USER_ID);
        const defaultKey = bindingKey(home, guestMemoryPath, GUEST_USER_ID);
        const opencode = await invoke<OpencodeConnection>('start_opencode', {
          folderPath: home,
          userId: GUEST_USER_ID,
          memorySubdir: guestMemoryPath,
        });
        await syncConnectorState(opencode, storedVaultPath, sessions);
        const modelConnected = await probeModelConnection(opencode, storedVaultPath);

        if (!active) {
          return;
        }

        setState({
          status: 'ready',
          layoutStore,
          memoryStore,
          skillStore,
          schedulerStore,
          opencodes: { [defaultKey]: opencode },
          defaultBindingKey: defaultKey,
          mcpStatus: {},
          vaultPath: storedVaultPath,
          modelConnected,
          vaultRevision,
          activeSkillsRevision: 0,
          schedulerRevision: 0,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [layoutStore, memoryStore, nativeRuntime, schedulerStore, skillStore, vaultService]);

  useEffect(() => {
    if (!nativeRuntime || state.status !== 'ready' || !state.vaultPath) {
      return;
    }

    const activeVaultPath = state.vaultPath;
    let active = true;
    let debounceId: number | null = null;
    let indexing = false;
    let pending = false;

    const scheduleIndex = (): void => {
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }

      debounceId = window.setTimeout(() => {
        debounceId = null;
        void runIndex();
      }, VAULT_REINDEX_DEBOUNCE_MS);
    };

    const runIndex = async (): Promise<void> => {
      if (indexing) {
        pending = true;
        return;
      }

      indexing = true;

      try {
        await indexVault({ path: activeVaultPath, isNew: false });
        await skillStore.reindex();

        if (!active) {
          return;
        }

        setState((current) => {
          if (current.status !== 'ready' || current.vaultPath !== activeVaultPath) {
            return current;
          }

          return {
            ...current,
            vaultRevision: current.vaultRevision + 1,
          };
        });
      } catch (error) {
        if (active) {
          console.warn('Failed to refresh vault index after file change.', error);
        }
      } finally {
        indexing = false;

        if (pending && active) {
          pending = false;
          void runIndex();
        }
      }
    };

    const unsubscribe = vaultService.watch(() => {
      scheduleIndex();
    });

    return () => {
      active = false;
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }
      unsubscribe();
    };
  }, [nativeRuntime, state.status, state.status === 'ready' ? state.vaultPath : null, vaultService, skillStore]);

  useEffect(() => {
    if (!nativeRuntime || state.status !== 'ready') {
      schedulerEngineRef.current = null;
      return;
    }

    const notify = async (payload: { title: string; body: string }): Promise<void> => {
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === 'granted';
      }

      if (!granted) {
        throw new Error('Notification permission denied.');
      }

      sendNotification(payload);
    };

    const engine = createSchedulerEngine({
      jobStore: state.schedulerStore,
      vaultService: state.vaultPath ? vaultService : null,
      createClient: () => createWorkspaceClient(defaultConnection(state), getOpencodeDirectory(state.vaultPath)),
      notify,
      onMutation: bumpSchedulerRevision,
    });

    schedulerEngineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      if (schedulerEngineRef.current === engine) {
        schedulerEngineRef.current = null;
      }
    };
  }, [
    nativeRuntime,
    state.status,
    state.status === 'ready' ? defaultConnection(state) : null,
    state.status === 'ready' ? state.schedulerStore : null,
    state.status === 'ready' ? state.vaultPath : null,
    vaultService,
  ]);

  useEffect(() => {
    if (!nativeRuntime || state.status !== 'ready') {
      return;
    }

    let active = true;
    let intervalId: number | null = null;

    const refreshSweepState = async (): Promise<void> => {
      try {
        const nextState = await readDailySweepState();
        if (active) {
          setMemorySweepState(nextState);
        }
      } catch (error) {
        if (active) {
          console.warn('Failed to read daily memory sweep state.', error);
        }
      }
    };

    const maybeRunSweep = async (force = false): Promise<void> => {
      await refreshSweepState();

      if (!state.vaultPath || !state.modelConnected) {
        return;
      }

      setMemorySweepBusy(true);
      try {
        const result = await runDailyMemorySweepIfDue(defaultConnection(state), state.vaultPath, { force });
        if (!active) {
          return;
        }

        setMemorySweepState(result.state);
        if (result.changed) {
          setState((current) =>
            current.status !== 'ready' || current.vaultPath !== state.vaultPath
              ? current
              : {
                  ...current,
                  vaultRevision: current.vaultRevision + 1,
                },
          );
        }
      } catch (error) {
        if (active) {
          console.warn('Daily memory sweep failed.', error);
          void refreshSweepState();
        }
      } finally {
        if (active) {
          setMemorySweepBusy(false);
        }
      }
    };

    void maybeRunSweep(false);
    intervalId = window.setInterval(() => {
      void maybeRunSweep(false);
    }, 60 * 60 * 1000);

    return () => {
      active = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    nativeRuntime,
    state.status,
    state.status === 'ready' ? state.modelConnected : false,
    state.status === 'ready' ? defaultConnection(state).baseUrl : null,
    state.status === 'ready' ? defaultConnection(state).username : null,
    state.status === 'ready' ? defaultConnection(state).password : null,
    state.status === 'ready' ? state.vaultPath : null,
  ]);

  useEffect(() => {
    if (!nativeRuntime || state.status !== 'ready' || currentUserState.status !== 'ready') {
      return;
    }

    const connection = defaultConnection(state);
    const vaultPath = state.vaultPath;
    const directory = getOpencodeDirectory(vaultPath);
    const githubSession = currentUserState.sessions.github;
    let active = true;

    // Seed every tracked + preloaded MCP as `checking` so the Settings
    // Connections section and status dock render without flicker before the
    // boot health check resolves. The per-pane polling hook swings qmd +
    // smart-connections to their real states once it runs.
    setState((current) =>
      current.status !== 'ready' || defaultConnection(current).baseUrl !== connection.baseUrl
        ? current
        : {
            ...current,
            mcpStatus: {
              ...current.mcpStatus,
              [EXA_MCP_NAME]: EXA_CHECKING_STATUS,
              ...Object.fromEntries(BUILTIN_MCP_NAMES.map((name) => [name, EXA_CHECKING_STATUS])),
            },
          },
    );

    void (async () => {
      const statuses = await checkTrackedMcpBootHealth(() => {
        const client = createWorkspaceClient(connection, directory);
        return client.mcp.status();
      }, githubSession);

      if (!active) {
        return;
      }

      setState((current) =>
        current.status !== 'ready' || defaultConnection(current).baseUrl !== connection.baseUrl
          ? current
          : {
              ...current,
              mcpStatus: {
                ...current.mcpStatus,
                ...statuses,
              },
            },
      );
    })();

    return () => {
      active = false;
    };
  }, [
    nativeRuntime,
    state.status,
    state.status === 'ready' ? defaultConnection(state).baseUrl : null,
    state.status === 'ready' ? defaultConnection(state).username : null,
    state.status === 'ready' ? defaultConnection(state).password : null,
    currentUserState.status === 'ready' ? currentUserState.sessions.github?.scopes.join(',') : null,
  ]);

  if (state.status === 'loading' || currentUserState.status === 'loading') {
    return (
      <div className="tinker-app">
        <main className="tinker-stage">
          <section className="tinker-card">
            <p className="tinker-eyebrow">Booting</p>
            <h1>Tinker is starting workspace</h1>
            <p className="tinker-muted">Launching OpenCode, loading vault state, restoring local context.</p>
          </section>
        </main>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="tinker-app">
        <main className="tinker-stage">
          <section className="tinker-card">
            <p className="tinker-eyebrow">Start-up failed</p>
            <h1>Tinker could not finish booting</h1>
            <p className="tinker-muted">{state.message}</p>
          </section>
        </main>
      </div>
    );
  }

  if (currentUserState.status === 'error') {
    return (
      <div className="tinker-app">
        <main className="tinker-stage">
          <section className="tinker-card">
            <p className="tinker-eyebrow">Start-up failed</p>
            <h1>Tinker could not finish booting</h1>
            <p className="tinker-muted">{currentUserState.message}</p>
          </section>
        </main>
      </div>
    );
  }

  const currentSessions = currentUserState.sessions;

  const reloadConnectionState = async (
    connection: OpencodeConnection,
    vaultPath: string | null,
  ): Promise<{ sessions: SSOStatus; modelConnected: boolean }> => {
    const sessions = await readAuthStatus();
    await syncConnectorState(connection, vaultPath, sessions);
    const modelConnected = await probeModelConnection(connection, vaultPath);

    return { sessions, modelConnected };
  };

  const bindSessionFolder = async (folderPath: string, isNew: boolean): Promise<void> => {
    requireNativeRuntime('Selecting a folder');
    setSessionFolderBusy(true);

    try {
      const memorySubdir = await getActiveMemoryPath(currentUserId);
      const connection = await acquireOpencode(folderPath, memorySubdir, currentUserId);
      await syncConnectorState(connection, folderPath, currentSessions);
      await vaultService.init({ path: folderPath, isNew });
      await indexVault({ path: folderPath, isNew });
      await skillStore.init(folderPath);
      await skillStore.reindex();
      window.localStorage.setItem(VAULT_PATH_KEY, folderPath);

      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              vaultPath: folderPath,
              vaultRevision: current.vaultRevision + 1,
              activeSkillsRevision: current.activeSkillsRevision + 1,
            },
      );
    } finally {
      setSessionFolderBusy(false);
    }
  };

  const handleActiveSkillsChanged = (): void => {
    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            activeSkillsRevision: current.activeSkillsRevision + 1,
        },
    );
  };

  const handleMemoryCommitted = (): void => {
    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            vaultRevision: current.vaultRevision + 1,
          },
    );
  };

  const handleRunMemorySweep = async (): Promise<void> => {
    if (memorySweepBusy || !state.vaultPath || !state.modelConnected) {
      return;
    }

    setMemorySweepBusy(true);
    try {
      const result = await runDailyMemorySweepIfDue(defaultConnection(state), state.vaultPath, { force: true });
      setMemorySweepState(result.state);
      if (result.changed) {
        handleMemoryCommitted();
      }
    } catch (error) {
      console.warn('Manual memory sweep failed.', error);
      setMemorySweepState(await readDailySweepState());
    } finally {
      setMemorySweepBusy(false);
    }
  };

  const handleConnectModel = async (): Promise<void> => {
    setModelAuthBusy(true);
    setModelAuthMessage('Waiting for OpenCode to finish AI-model sign-in…');

    try {
      requireNativeRuntime('Connecting AI model');
      await connectModelProvider(defaultConnection(state), state.vaultPath);
      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              modelConnected: true,
            },
      );
      setModelAuthMessage('AI model connected through OpenCode.');
    } catch (error) {
      setModelAuthMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setModelAuthBusy(false);
    }
  };

  const handleDisconnectModel = async (): Promise<void> => {
    setModelAuthBusy(true);
    setModelAuthMessage(null);

    try {
      requireNativeRuntime('Disconnecting AI model');
      await disconnectModelProvider(defaultConnection(state), state.vaultPath);
      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              modelConnected: false,
            },
      );
      setModelAuthMessage('AI model disconnected.');
    } catch (error) {
      setModelAuthMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setModelAuthBusy(false);
    }
  };

  const handleProviderConnect = async (provider: AuthProvider): Promise<void> => {
    setProviderBusyValue(provider, true);
    setProviderMessage(provider, `Waiting for ${providerDisplayName(provider)} sign-in…`);

    try {
      requireNativeRuntime(`Connecting ${providerDisplayName(provider)}`);
      const session = await invoke<SSOSession>('auth_sign_in', { provider });
      if (providerNeedsRefreshToken(provider) && session.refreshToken.length === 0) {
        throw new Error(`${providerDisplayName(provider)} sign-in did not return refresh token. Try again.`);
      }
      await upsertUser(toStoredUser(session));
      await getActiveMemoryPath(buildStoredUserId(session.provider, session.userId));

      const nextState = await refreshCurrentUser();
      if (providerNeedsWorkspaceRefresh(provider)) {
        await refreshAllConnectorState(nextState.sessions);
      } else {
        const reloaded = await reloadConnectionState(defaultConnection(state), state.vaultPath);
        await syncCurrentUserMemoryPath(reloaded.sessions);
        setState((current) =>
          current.status !== 'ready'
            ? current
            : {
                ...current,
                modelConnected: reloaded.modelConnected,
              },
        );
      }

      setProviderMessage(provider, `${providerDisplayName(provider)} connected as ${session.email}.`);
      setGuestMessage(null);
    } catch (error) {
      setProviderMessage(provider, error instanceof Error ? error.message : String(error));
    } finally {
      setProviderBusyValue(provider, false);
    }
  };

  const handleProviderDisconnect = async (provider: AuthProvider): Promise<void> => {
    setProviderBusyValue(provider, true);
    setProviderMessage(provider, null);

    try {
      requireNativeRuntime(`Disconnecting ${providerDisplayName(provider)}`);
      await invoke('auth_sign_out', { provider });

      const nextState = await refreshCurrentUser();
      if (providerNeedsWorkspaceRefresh(provider)) {
        await refreshAllConnectorState(nextState.sessions);
      } else {
        const reloaded = await reloadConnectionState(defaultConnection(state), state.vaultPath);
        await syncCurrentUserMemoryPath(reloaded.sessions);
        setState((current) =>
          current.status !== 'ready'
            ? current
            : {
                ...current,
                modelConnected: reloaded.modelConnected,
              },
        );
      }

      setProviderMessage(provider, `${providerDisplayName(provider)} disconnected.`);
      setGuestMessage(null);
    } catch (error) {
      setProviderMessage(provider, error instanceof Error ? error.message : String(error));
    } finally {
      setProviderBusyValue(provider, false);
    }
  };

  const handleContinueAsGuest = async (): Promise<void> => {
    setGuestBusy(true);
    setGuestMessage('Switching to guest mode…');

    try {
      requireNativeRuntime('Continuing as guest');

      const providersToClear = (['google', 'github', 'microsoft'] as const).filter(
        (provider) => currentSessions[provider] !== null,
      );

      if (providersToClear.length > 0) {
        await Promise.all(providersToClear.map((provider) => invoke('auth_sign_out', { provider })));
      }

      await upsertUser(createGuestUser());
      const nextUserState = await refreshCurrentUser();

      if (providersToClear.includes('github')) {
        await refreshAllConnectorState(nextUserState.sessions);
      } else {
        const reloaded = await reloadConnectionState(defaultConnection(state), state.vaultPath);
        await syncCurrentUserMemoryPath(reloaded.sessions);
        setState((current) =>
          current.status !== 'ready'
            ? current
            : {
                ...current,
                modelConnected: reloaded.modelConnected,
              },
        );
      }

      setProviderMessages(EMPTY_PROVIDER_MESSAGES);
      setGuestMessage('Guest mode active.');
    } catch (error) {
      setGuestMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setGuestBusy(false);
    }
  };

  const handleSelectSessionFolder = async (): Promise<string | null> => {
    if (sessionFolderBusy) {
      return null;
    }

    requireNativeRuntime('Selecting a folder');
    const folderPath = await selectSessionFolder();
    if (!folderPath) {
      return null;
    }

    await bindSessionFolder(folderPath, false);
    return folderPath;
  };

  const handleCreateDefaultVault = async (): Promise<void> => {
    requireNativeRuntime('Creating the default vault');
    const home = await homeDir();
    const defaultPath = await join(home, 'Tinker', 'knowledge');
    await bindSessionFolder(defaultPath, true);
  };

  const handleRunScheduledJobNow = async (jobId: string): Promise<void> => {
    const engine = schedulerEngineRef.current;
    if (!engine) {
      throw new Error('Scheduler is not ready yet.');
    }

    await engine.runNow(jobId);
  };

  const currentUser = resolveCurrentUser(currentSessions);
  const currentUserId =
    currentUserState.authState === 'authenticated'
      ? currentUserState.user.id
      : pickCurrentUserId(currentSessions);

  return (
    <div className="tinker-app">
      <Workspace
        key={currentUserId}
        currentUserId={currentUserId}
        currentUserName={currentUser.displayName}
        currentUserProvider={currentUser.provider}
        currentUserEmail={currentUser.email}
        currentUserAvatarUrl={currentUser.avatarUrl}
        nativeRuntimeAvailable={nativeRuntime}
        layoutStore={state.layoutStore}
        memoryStore={state.memoryStore}
        schedulerStore={state.schedulerStore}
        schedulerRevision={state.schedulerRevision}
        skillStore={state.skillStore}
        modelConnected={state.modelConnected}
        modelAuthBusy={modelAuthBusy}
        modelAuthMessage={modelAuthMessage}
        guestBusy={guestBusy}
        guestMessage={guestMessage}
        googleAuthBusy={providerBusy.google}
        googleAuthMessage={providerMessages.google}
        githubAuthBusy={providerBusy.github}
        githubAuthMessage={providerMessages.github}
        microsoftAuthBusy={providerBusy.microsoft}
        microsoftAuthMessage={providerMessages.microsoft}
        opencode={defaultConnection(state)}
        sessions={currentSessions}
        mcpStatus={state.mcpStatus}
        vaultPath={state.vaultPath}
        activeSkillsRevision={state.activeSkillsRevision}
        memorySweepState={memorySweepState}
        memorySweepBusy={memorySweepBusy}
        onContinueAsGuest={handleContinueAsGuest}
        sessionFolderBusy={sessionFolderBusy}
        onSelectSessionFolder={handleSelectSessionFolder}
        onCreateVault={handleCreateDefaultVault}
        onSelectVault={handleSelectSessionFolder}
        onConnectGoogle={() => handleProviderConnect('google')}
        onDisconnectGoogle={() => handleProviderDisconnect('google')}
        onConnectGithub={() => handleProviderConnect('github')}
        onDisconnectGithub={() => handleProviderDisconnect('github')}
        onConnectMicrosoft={() => handleProviderConnect('microsoft')}
        onDisconnectMicrosoft={() => handleProviderDisconnect('microsoft')}
        onConnectModel={handleConnectModel}
        onDisconnectModel={handleDisconnectModel}
        onRunScheduledJobNow={handleRunScheduledJobNow}
        onSchedulerChanged={bumpSchedulerRevision}
        onActiveSkillsChanged={handleActiveSkillsChanged}
        onRunMemorySweep={handleRunMemorySweep}
        onMemoryCommitted={handleMemoryCommitted}
        onRequestMcpRespawn={() => refreshAllConnectorState(currentSessions)}
        getConnectionForPane={(paneData) => {
          if (state.status !== 'ready') return WEB_PREVIEW_CONNECTION;
          const folderPath = (paneData as unknown as { folderPath?: string }).folderPath;
          const memorySubdir = (paneData as unknown as { memorySubdir?: string }).memorySubdir;
          if (folderPath && memorySubdir) {
            return connectionFor(state, bindingKey(folderPath, memorySubdir, currentUserId));
          }
          return defaultConnection(state);
        }}
        releaseConnectionForPane={(paneData) => {
          if (state.status !== 'ready') return;
          const folderPath = (paneData as unknown as { folderPath?: string }).folderPath;
          const memorySubdir = (paneData as unknown as { memorySubdir?: string }).memorySubdir;
          if (folderPath && memorySubdir) {
            void releaseOpencode(folderPath, memorySubdir, currentUserId);
          }
        }}
      />
    </div>
  );
};
