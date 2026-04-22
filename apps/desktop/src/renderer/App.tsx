import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
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
  syncActiveMemoryPath,
  upsertUser,
  type MemoryRunState,
} from '@tinker/memory';
import { createSchedulerEngine, type SchedulerEngine } from '@tinker/scheduler';
import type { LayoutStore, MemoryStore, ScheduledJobStore, SkillStore, SSOStatus, SSOSession, User, VaultConfig } from '@tinker/shared-types';
import { DEFAULT_USER_ID, openFolderPicker, type AuthProvider, type OpencodeConnection, VAULT_PATH_KEY } from '../bindings.js';
import { readDailySweepState, runDailyMemorySweepIfDue } from './memory.js';
import {
  checkTrackedMcpBootHealth,
  EXA_CHECKING_STATUS,
  EXA_MCP_NAME,
  GITHUB_MCP_NAME,
  LINEAR_MCP_NAME,
  type MCPStatus,
} from './integrations.js';
import { createWorkspaceClient, getOpencodeDirectory, pickFirstOauthProvider } from './opencode.js';
import { isTauriRuntime } from './runtime.js';
import {
  buildStoredUserId,
  EMPTY_AUTH_STATUS,
  toStoredUser,
  useCurrentUser,
} from './useCurrentUser.js';
import { Workspace } from './workspace/Workspace.js';

type ReadyAppState = {
  status: 'ready';
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  skillStore: SkillStore;
  schedulerStore: ScheduledJobStore;
  opencode: OpencodeConnection;
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

type RestartOpencodeOptions = {
  folderPath?: string;
  memorySubdir?: string;
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

const pickCurrentUserId = (sessions: SSOStatus): User['id'] => {
  const activeSession = sessions.google ?? sessions.github ?? sessions.microsoft;
  return activeSession
    ? buildStoredUserId(activeSession.provider, activeSession.userId)
    : DEFAULT_USER_ID;
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

const restartOpencode = (options: RestartOpencodeOptions): Promise<OpencodeConnection> => {
  return invoke<OpencodeConnection>('restart_opencode', { options });
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

const resolveRestartOpencodeOptions = async (
  sessions: SSOStatus,
  folderPath: string | null,
): Promise<RestartOpencodeOptions> => {
  return {
    ...(folderPath ? { folderPath } : {}),
    memorySubdir: await getActiveMemoryPath(pickCurrentUserId(sessions)),
  };
};

const restartWorkspaceOpencode = async (
  vaultPath: string | null,
  sessions: SSOStatus,
): Promise<{ opencode: OpencodeConnection; modelConnected: boolean }> => {
  const opencode = await restartOpencode(await resolveRestartOpencodeOptions(sessions, vaultPath));
  await syncConnectorState(opencode, vaultPath, sessions);
  const modelConnected = await probeModelConnection(opencode, vaultPath);
  return { opencode, modelConnected };
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
  const [sessionFolderBusy, setSessionFolderBusy] = useState(false);
  const schedulerEngineRef = useRef<SchedulerEngine | null>(null);
  const { state: currentUserState, refresh: refreshCurrentUser } = useCurrentUser(nativeRuntime);

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
            mcpStatus: {},
            vaultPath: null,
            modelConnected: false,
            vaultRevision: 0,
            activeSkillsRevision: 0,
            schedulerRevision: 0,
          });
          return;
        }

        let opencode = await invoke<OpencodeConnection>('get_opencode_connection');
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
          opencode,
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
    if (!nativeRuntime || state.status !== 'ready' || currentUserState.status !== 'ready') {
      return;
    }

    let active = true;
    const activeSessions = currentUserState.sessions;
    const activeVaultPath = state.vaultPath;
    const activeBaseUrl = state.opencode.baseUrl;

    void (async () => {
      await syncCurrentUserMemoryPath(activeSessions);
      try {
        const nextState = await restartWorkspaceOpencode(activeVaultPath, activeSessions);
        if (!active) {
          return;
        }

        setState((current) =>
          current.status !== 'ready' || current.opencode.baseUrl !== activeBaseUrl
            ? current
            : {
                ...current,
                opencode: nextState.opencode,
                modelConnected: nextState.modelConnected,
              },
        );
      } catch (error) {
        console.warn('Could not restart OpenCode after auth change.', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    currentUserState.status,
    currentUserState.status === 'ready' ? currentUserState.sessions : EMPTY_AUTH_STATUS,
    nativeRuntime,
    state.status,
    state.status === 'ready' ? state.opencode.baseUrl : null,
    state.status === 'ready' ? state.vaultPath : null,
  ]);

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
    if (!nativeRuntime || state.status !== 'ready' || currentUserState.status !== 'ready') {
      return;
    }

    const connection = state.opencode;
    const directory = getOpencodeDirectory(state.vaultPath);
    const githubSession = currentUserState.sessions.github;
    let active = true;

    setState((current) =>
      current.status !== 'ready' || current.opencode.baseUrl !== connection.baseUrl
        ? current
        : {
            ...current,
            mcpStatus: {
              ...current.mcpStatus,
              [EXA_MCP_NAME]: EXA_CHECKING_STATUS,
              [GITHUB_MCP_NAME]: EXA_CHECKING_STATUS,
              [LINEAR_MCP_NAME]: EXA_CHECKING_STATUS,
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
        current.status !== 'ready' || current.opencode.baseUrl !== connection.baseUrl
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
    state.status === 'ready' ? state.opencode.baseUrl : null,
    state.status === 'ready' ? state.opencode.username : null,
    state.status === 'ready' ? state.opencode.password : null,
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

  const refreshWorkspaceConnection = async (sessions: SSOStatus): Promise<void> => {
    requireNativeRuntime('Restarting OpenCode');
    const nextState = await restartWorkspaceOpencode(state.vaultPath, sessions);
    await syncCurrentUserMemoryPath(sessions);

    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            opencode: nextState.opencode,
            modelConnected: nextState.modelConnected,
            mcpStatus: {
              ...current.mcpStatus,
              [EXA_MCP_NAME]: EXA_CHECKING_STATUS,
            },
          },
    );
  };

  const setSessionFolder = async (config: VaultConfig): Promise<void> => {
    requireNativeRuntime('Selecting a folder');
    setSessionFolderBusy(true);

    try {
      const nextState = await restartWorkspaceOpencode(config.path, currentSessions);
      await vaultService.init(config);
      await indexVault(config);
      await skillStore.init(config.path);
      await skillStore.reindex();
      window.localStorage.setItem(VAULT_PATH_KEY, config.path);

      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              opencode: nextState.opencode,
              vaultPath: config.path,
              modelConnected: nextState.modelConnected,
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

      const nextState = await refreshCurrentUser();
      await refreshWorkspaceConnection(nextState.sessions);

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
      const nextState = await refreshCurrentUser();
      await refreshWorkspaceConnection(nextState.sessions);

      setProviderMessage(provider, `${providerDisplayName(provider)} disconnected.`);
    } catch (error) {
      setProviderMessage(provider, error instanceof Error ? error.message : String(error));
    } finally {
      setProviderBusyValue(provider, false);
    }
  };

  const handleSelectSessionFolder = async (): Promise<void> => {
    if (sessionFolderBusy) {
      return;
    }

    requireNativeRuntime('Selecting a folder');
    const folderPath = await selectSessionFolder();
    if (!folderPath) {
      return;
    }

    await setSessionFolder({ path: folderPath, isNew: false });
  };

  const handleCreateDefaultVault = async (): Promise<void> => {
    requireNativeRuntime('Creating the default vault');
    const home = await homeDir();
    const defaultPath = await join(home, 'Tinker', 'knowledge');
    await setSessionFolder({ path: defaultPath, isNew: true });
  };

  const handleRunScheduledJobNow = async (jobId: string): Promise<void> => {
    const engine = schedulerEngineRef.current;
    if (!engine) {
      throw new Error('Scheduler is not ready yet.');
    }

    await engine.runNow(jobId);
  };

  const currentUserId =
    currentUserState.authState === 'authenticated'
      ? currentUserState.user.id
      : pickCurrentUserId(currentSessions);

  return (
    <div className="tinker-app">
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
        sessions={currentSessions}
        mcpStatus={state.mcpStatus}
        vaultPath={state.vaultPath}
        vaultRevision={state.vaultRevision}
        activeSkillsRevision={state.activeSkillsRevision}
        memorySweepState={memorySweepState}
        memorySweepBusy={memorySweepBusy}
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
      />
    </div>
  );
};
