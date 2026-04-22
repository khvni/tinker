import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
  syncActiveMemoryPath,
  upsertUser,
  type MemoryRunState,
} from '@tinker/memory';
import { createSchedulerEngine, type SchedulerEngine } from '@tinker/scheduler';
import type { LayoutStore, MemoryStore, ScheduledJobStore, SkillStore, SSOStatus, SSOSession, User, VaultConfig } from '@tinker/shared-types';
import { DEFAULT_USER_ID, ONBOARDING_KEY, type AuthProvider, type AuthStatus, type OpencodeConnection, VAULT_PATH_KEY } from '../bindings.js';
import { readDailySweepState, runDailyMemorySweepIfDue } from './memory.js';
import {
  checkExaBootHealth,
  EXA_CHECKING_STATUS,
  EXA_MCP_NAME,
  type MCPStatus,
} from './integrations.js';
import { FirstRun } from './panes/FirstRun.js';
import { createWorkspaceClient, getOpencodeDirectory, pickFirstOauthProvider } from './opencode.js';
import { SignIn } from './routes/SignIn/index.js';
import { isTauriRuntime, WEB_PREVIEW_NOTICE } from './runtime.js';
import { Workspace } from './workspace/Workspace.js';

type ReadyAppState = {
  status: 'ready';
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  skillStore: SkillStore;
  schedulerStore: ScheduledJobStore;
  opencode: OpencodeConnection;
  sessions: SSOStatus;
  mcpStatus: Record<string, MCPStatus>;
  vaultPath: string | null;
  onboarded: boolean;
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

const buildStoredUserId = (provider: User['provider'], providerUserId: string): string => {
  return `${provider}:${providerUserId}`;
};

const createLocalUser = (): User => {
  const timestamp = new Date().toISOString();

  return {
    id: DEFAULT_USER_ID,
    provider: 'local',
    providerUserId: DEFAULT_USER_ID,
    displayName: 'Offline mode',
    createdAt: timestamp,
    lastSeenAt: timestamp,
  };
};

const pickCurrentUserId = (sessions: SSOStatus): User['id'] => {
  const activeSession = sessions.google ?? sessions.github ?? sessions.microsoft;
  return activeSession
    ? buildStoredUserId(activeSession.provider, activeSession.userId)
    : DEFAULT_USER_ID;
};

const toStoredUser = (session: SSOSession): User => {
  const timestamp = new Date().toISOString();

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

const getDefaultVaultPath = async (): Promise<string> => {
  const home = await homeDir();
  return join(home, 'Tinker', 'knowledge');
};

const selectVault = async (): Promise<string | null> => {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: 'Select your Tinker vault',
  });

  return typeof selected === 'string' ? selected : null;
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
  const [memorySweepState, setMemorySweepState] = useState<MemoryRunState | null>(null);
  const [memorySweepBusy, setMemorySweepBusy] = useState(false);
  const schedulerEngineRef = useRef<SchedulerEngine | null>(null);

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

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!nativeRuntime) {
          if (!active) {
            return;
          }

          setState({
            status: 'ready',
            layoutStore,
            memoryStore,
            skillStore,
            schedulerStore,
            opencode: WEB_PREVIEW_CONNECTION,
            sessions: withDefaultSessions(null),
            mcpStatus: {},
            vaultPath: null,
            onboarded: false,
            modelConnected: false,
            vaultRevision: 0,
            activeSkillsRevision: 0,
            schedulerRevision: 0,
          });
          return;
        }

        const [opencode, sessions] = await Promise.all([invoke<OpencodeConnection>('get_opencode_connection'), readAuthStatus()]);
        await upsertUser(createLocalUser());
        await syncCurrentUserMemoryPath(sessions, { emit: false });
        const vaultPath = window.localStorage.getItem(VAULT_PATH_KEY);

        let vaultRevision = 0;
        if (vaultPath) {
          const config = { path: vaultPath, isNew: false };
          await vaultService.init(config);
          await indexVault(config);
          await skillStore.init(vaultPath);
          await skillStore.reindex();
          vaultRevision = 1;
        }

        await syncConnectorState(opencode, vaultPath, sessions).catch((error) => {
          console.warn('Could not restore connector state on boot.', error);
        });
        const modelConnected = await probeModelConnection(opencode, vaultPath);

        if (!active) {
          return;
        }

        setState({
          status: 'ready',
          layoutStore,
          memoryStore,
          skillStore,
          schedulerStore,
          opencode,
          sessions,
          mcpStatus: {},
          vaultPath,
          onboarded: window.localStorage.getItem(ONBOARDING_KEY) === '1',
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
      createClient: () => createWorkspaceClient(state.opencode, getOpencodeDirectory(state.vaultPath)),
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
    state.status === 'ready' ? state.opencode : null,
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
        const result = await runDailyMemorySweepIfDue(state.opencode, state.vaultPath, { force });
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
    state.status === 'ready' ? state.opencode.baseUrl : null,
    state.status === 'ready' ? state.opencode.username : null,
    state.status === 'ready' ? state.opencode.password : null,
    state.status === 'ready' ? state.vaultPath : null,
  ]);

  useEffect(() => {
    if (!nativeRuntime || state.status !== 'ready') {
      return;
    }

    const connection = state.opencode;
    const directory = getOpencodeDirectory(state.vaultPath);
    let active = true;

    setState((current) =>
      current.status !== 'ready' || current.opencode.baseUrl !== connection.baseUrl
        ? current
        : {
            ...current,
            mcpStatus: {
              ...current.mcpStatus,
              [EXA_MCP_NAME]: EXA_CHECKING_STATUS,
            },
          },
    );

    void (async () => {
      const status = await checkExaBootHealth(() => {
        const client = createWorkspaceClient(connection, directory);
        return client.mcp.status();
      });

      if (!active) {
        return;
      }

      setState((current) =>
        current.status !== 'ready' || current.opencode.baseUrl !== connection.baseUrl
          ? current
          : {
              ...current,
              mcpStatus: {
                ...current.mcpStatus,
                [EXA_MCP_NAME]: status,
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
    state.status === 'ready' ? state.opencode.baseUrl : null,
    state.status === 'ready' ? state.opencode.username : null,
    state.status === 'ready' ? state.opencode.password : null,
  ]);

  if (state.status === 'loading') {
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

  const reloadConnectionState = async (connection: OpencodeConnection, vaultPath: string | null) => {
    const sessions = await readAuthStatus();
    await syncConnectorState(connection, vaultPath, sessions);
    const modelConnected = await probeModelConnection(connection, vaultPath);

    return { sessions, modelConnected };
  };

  const refreshWorkspaceConnection = async (): Promise<void> => {
    requireNativeRuntime('Restarting OpenCode');
    const opencode = await invoke<OpencodeConnection>('restart_opencode');
    const nextState = await reloadConnectionState(opencode, state.vaultPath);
    await syncCurrentUserMemoryPath(nextState.sessions);

    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            opencode,
            sessions: nextState.sessions,
            mcpStatus: {
              ...current.mcpStatus,
              [EXA_MCP_NAME]: EXA_CHECKING_STATUS,
            },
            modelConnected: nextState.modelConnected,
          },
    );
  };

  const setVaultPath = async (config: VaultConfig): Promise<void> => {
    requireNativeRuntime('Selecting a vault');
    await vaultService.init(config);
    await indexVault(config);
    await skillStore.init(config.path);
    await skillStore.reindex();
    window.localStorage.setItem(VAULT_PATH_KEY, config.path);

    await syncConnectorState(state.opencode, config.path, state.sessions).catch((error) => {
      console.warn('Could not refresh connector state after vault change.', error);
    });
    const modelConnected = await probeModelConnection(state.opencode, config.path);

    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            vaultPath: config.path,
            modelConnected,
            vaultRevision: current.vaultRevision + 1,
            activeSkillsRevision: current.activeSkillsRevision + 1,
          },
    );
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
      const result = await runDailyMemorySweepIfDue(state.opencode, state.vaultPath, { force: true });
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
      await connectModelProvider(state.opencode, state.vaultPath);
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
      await disconnectModelProvider(state.opencode, state.vaultPath);
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

      if (providerNeedsWorkspaceRefresh(provider)) {
        await refreshWorkspaceConnection();
      } else {
        const nextState = await reloadConnectionState(state.opencode, state.vaultPath);
        await syncCurrentUserMemoryPath(nextState.sessions);
        setState((current) =>
          current.status !== 'ready'
            ? current
            : {
                ...current,
                sessions: nextState.sessions,
                modelConnected: nextState.modelConnected,
              },
        );
      }

      setProviderMessage(provider, `${providerDisplayName(provider)} connected as ${session.email}.`);
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

      if (providerNeedsWorkspaceRefresh(provider)) {
        await refreshWorkspaceConnection();
      } else {
        const nextState = await reloadConnectionState(state.opencode, state.vaultPath);
        await syncCurrentUserMemoryPath(nextState.sessions);
        setState((current) =>
          current.status !== 'ready'
            ? current
            : {
                ...current,
                sessions: nextState.sessions,
                modelConnected: nextState.modelConnected,
              },
        );
      }

      setProviderMessage(provider, `${providerDisplayName(provider)} disconnected.`);
    } catch (error) {
      setProviderMessage(provider, error instanceof Error ? error.message : String(error));
    } finally {
      setProviderBusyValue(provider, false);
    }
  };

  const handleCreateVault = async (): Promise<void> => {
    requireNativeRuntime('Creating the default vault');
    await setVaultPath({
      path: await getDefaultVaultPath(),
      isNew: true,
    });
  };

  const handlePickVault = async (): Promise<void> => {
    requireNativeRuntime('Selecting an existing vault');
    const vaultPath = await selectVault();
    if (vaultPath) {
      await setVaultPath({ path: vaultPath, isNew: false });
    }
  };

  const finishOnboarding = (): void => {
    if (!nativeRuntime) {
      return;
    }

    window.localStorage.setItem(ONBOARDING_KEY, '1');
    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            onboarded: true,
          },
    );
  };

  const handleRunScheduledJobNow = async (jobId: string): Promise<void> => {
    const engine = schedulerEngineRef.current;
    if (!engine) {
      throw new Error('Scheduler is not ready yet.');
    }

    await engine.runNow(jobId);
  };

  const hasSignedIn =
    state.sessions.google !== null ||
    state.sessions.github !== null ||
    state.sessions.microsoft !== null;
  const signInGateVisible = nativeRuntime && !hasSignedIn;
  const workspaceAvailable = nativeRuntime && state.onboarded && hasSignedIn;
  const currentUserId = pickCurrentUserId(state.sessions);

  if (signInGateVisible) {
    return (
      <div className="tinker-app">
        <SignIn
          nativeRuntimeAvailable={nativeRuntime}
          providerMessages={providerMessages}
          onSignIn={handleProviderConnect}
        />
      </div>
    );
  }

  return (
    <div className="tinker-app">
      {!workspaceAvailable ? (
        <FirstRun
          nativeRuntimeAvailable={nativeRuntime}
          runtimeNotice={nativeRuntime ? null : WEB_PREVIEW_NOTICE}
          modelConnected={state.modelConnected}
          modelAuthBusy={modelAuthBusy}
          modelAuthMessage={modelAuthMessage}
          googleAuthBusy={providerBusy.google}
          googleAuthMessage={providerMessages.google}
          githubAuthBusy={providerBusy.github}
          githubAuthMessage={providerMessages.github}
          microsoftAuthBusy={providerBusy.microsoft}
          microsoftAuthMessage={providerMessages.microsoft}
          sessions={state.sessions}
          mcpStatus={state.mcpStatus}
          vaultPath={state.vaultPath}
          onConnectModel={handleConnectModel}
          onConnectGoogle={() => handleProviderConnect('google')}
          onConnectGithub={() => handleProviderConnect('github')}
          onConnectMicrosoft={() => handleProviderConnect('microsoft')}
          onCreateVault={handleCreateVault}
          onSelectVault={handlePickVault}
          onContinue={finishOnboarding}
        />
      ) : (
        <Workspace
          key={currentUserId}
          currentUserId={currentUserId}
          layoutStore={state.layoutStore}
          memoryStore={state.memoryStore}
          schedulerStore={state.schedulerStore}
          schedulerRevision={state.schedulerRevision}
          skillStore={state.skillStore}
          modelConnected={state.modelConnected}
          modelAuthBusy={modelAuthBusy}
          modelAuthMessage={modelAuthMessage}
          googleAuthBusy={providerBusy.google}
          googleAuthMessage={providerMessages.google}
          githubAuthBusy={providerBusy.github}
          githubAuthMessage={providerMessages.github}
          microsoftAuthBusy={providerBusy.microsoft}
          microsoftAuthMessage={providerMessages.microsoft}
          opencode={state.opencode}
          sessions={state.sessions}
          mcpStatus={state.mcpStatus}
          vaultPath={state.vaultPath}
          vaultRevision={state.vaultRevision}
          activeSkillsRevision={state.activeSkillsRevision}
          memorySweepState={memorySweepState}
          memorySweepBusy={memorySweepBusy}
          onConnectGoogle={() => handleProviderConnect('google')}
          onDisconnectGoogle={() => handleProviderDisconnect('google')}
          onConnectGithub={() => handleProviderConnect('github')}
          onDisconnectGithub={() => handleProviderDisconnect('github')}
          onConnectMicrosoft={() => handleProviderConnect('microsoft')}
          onDisconnectMicrosoft={() => handleProviderDisconnect('microsoft')}
          onConnectModel={handleConnectModel}
          onDisconnectModel={handleDisconnectModel}
          onCreateVault={handleCreateVault}
          onSelectVault={handlePickVault}
          onRunScheduledJobNow={handleRunScheduledJobNow}
          onSchedulerChanged={bumpSchedulerRevision}
          onActiveSkillsChanged={handleActiveSkillsChanged}
          onRunMemorySweep={handleRunMemorySweep}
          onMemoryCommitted={handleMemoryCommitted}
        />
      )}
    </div>
  );
};
