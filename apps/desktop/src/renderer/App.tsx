import { useEffect, useMemo, useState, type JSX } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  createLayoutStore,
  createMemoryStore,
  createSkillStore,
  createVaultService,
  indexVault,
  type MemoryRunState,
} from '@tinker/memory';
import type { LayoutStore, MemoryStore, SkillStore, SSOSession, VaultConfig } from '@tinker/shared-types';
import { deletePassword, getPassword, setPassword } from 'tauri-plugin-keyring-api';
import {
  DEFAULT_USER_ID,
  GOOGLE_SESSION_ACCOUNT,
  KEYRING_SERVICE,
  ONBOARDING_KEY,
  VAULT_PATH_KEY,
  type GoogleOAuthSession,
  type OpencodeConnection,
} from '../bindings.js';
import { readDailySweepState, runDailyMemorySweepIfDue } from './memory.js';
import { FirstRun } from './panes/FirstRun.js';
import { createWorkspaceClient, getOpencodeDirectory, OPENCODE_OPENAI_PROVIDER_ID } from './opencode.js';
import { Workspace } from './workspace/Workspace.js';

type ReadyAppState = {
  status: 'ready';
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  skillStore: SkillStore;
  opencode: OpencodeConnection;
  session: SSOSession | null;
  vaultPath: string | null;
  onboarded: boolean;
  modelConnected: boolean;
  vaultRevision: number;
  activeSkillsRevision: number;
};

type AppState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ReadyAppState;

type StoredSSOSession = {
  provider: 'google';
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
};

const MODEL_CONNECT_POLL_INTERVAL_MS = 1_500;
const MODEL_CONNECT_TIMEOUT_MS = 180_000;
const VAULT_REINDEX_DEBOUNCE_MS = 300;
const OPENCODE_AUTH_HOST = 'auth.openai.com';

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const isStoredSession = (value: unknown): value is StoredSSOSession => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const { avatarUrl, scopes } = candidate;

  return (
    candidate.provider === 'google' &&
    isNonEmptyString(candidate.userId) &&
    isNonEmptyString(candidate.email) &&
    isNonEmptyString(candidate.displayName) &&
    isNonEmptyString(candidate.accessToken) &&
    isNonEmptyString(candidate.refreshToken) &&
    isNonEmptyString(candidate.expiresAt) &&
    !Number.isNaN(Date.parse(candidate.expiresAt)) &&
    Array.isArray(scopes) &&
    scopes.every((scope) => isNonEmptyString(scope)) &&
    (avatarUrl === undefined || isNonEmptyString(avatarUrl))
  );
};

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
};

const readStoredSession = async (): Promise<SSOSession | null> => {
  const raw = await getPassword(KEYRING_SERVICE, GOOGLE_SESSION_ACCOUNT);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredSession(parsed)) {
      throw new Error('Stored Google session was malformed.');
    }

    return parsed;
  } catch {
    await deletePassword(KEYRING_SERVICE, GOOGLE_SESSION_ACCOUNT);
    return null;
  }
};

const storeSession = async (session: SSOSession | null): Promise<void> => {
  if (!session) {
    await deletePassword(KEYRING_SERVICE, GOOGLE_SESSION_ACCOUNT);
    return;
  }

  await setPassword(KEYRING_SERVICE, GOOGLE_SESSION_ACCOUNT, JSON.stringify(session));
};

const mergeGoogleSession = (previous: SSOSession | null, next: SSOSession): SSOSession => {
  if (next.refreshToken.length > 0) {
    return next;
  }

  if (!previous) {
    return next;
  }

  if (previous.provider !== next.provider || previous.userId !== next.userId) {
    return next;
  }

  return {
    ...next,
    refreshToken: previous.refreshToken,
  };
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

const isModelConnected = async (connection: OpencodeConnection, vaultPath: string | null): Promise<boolean> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const response = await client.provider.list();
  return response.data?.connected.includes(OPENCODE_OPENAI_PROVIDER_ID) ?? false;
};

const probeModelConnection = async (connection: OpencodeConnection, vaultPath: string | null): Promise<boolean> => {
  try {
    return await isModelConnected(connection, vaultPath);
  } catch (error) {
    console.warn('Could not determine whether GPT-5.4 is connected. Continuing with model disconnected.', error);
    return false;
  }
};

const waitForModelConnection = async (connection: OpencodeConnection, vaultPath: string | null): Promise<boolean> => {
  const deadline = Date.now() + MODEL_CONNECT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await isModelConnected(connection, vaultPath)) {
      return true;
    }

    await wait(MODEL_CONNECT_POLL_INTERVAL_MS);
  }

  return false;
};

const connectModelProvider = async (connection: OpencodeConnection, vaultPath: string | null): Promise<void> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const authResponse = await client.provider.auth();
  const methods = authResponse.data?.[OPENCODE_OPENAI_PROVIDER_ID] ?? [];
  const methodIndex = methods.findIndex((method) => method.type === 'oauth');

  if (methodIndex < 0) {
    throw new Error('OpenCode did not expose an OAuth method for the OpenAI provider.');
  }

  const authorizeResponse = await client.provider.oauth.authorize({
    providerID: OPENCODE_OPENAI_PROVIDER_ID,
    method: methodIndex,
  });
  const authorization = authorizeResponse.data;

  if (!authorization?.url) {
    throw new Error('OpenCode did not return an authorization URL for the OpenAI provider.');
  }

  const authorizationUrl = new URL(authorization.url);
  if (
    authorizationUrl.protocol !== 'https:' ||
    authorizationUrl.hostname !== OPENCODE_AUTH_HOST ||
    !/^\/(?:oauth|codex)\//u.test(authorizationUrl.pathname)
  ) {
    throw new Error('OpenCode returned an unexpected authorization URL for the OpenAI provider.');
  }

  await openExternal(authorizationUrl.toString());

  if (!(await waitForModelConnection(connection, vaultPath))) {
    throw new Error('OpenCode did not finish connecting GPT-5.4 before the authorization timed out.');
  }
};

const disconnectModelProvider = async (connection: OpencodeConnection, vaultPath: string | null): Promise<void> => {
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  await client.auth.remove({ providerID: OPENCODE_OPENAI_PROVIDER_ID });
};

export const App = (): JSX.Element => {
  const memoryStore = useMemo(() => createMemoryStore(), []);
  const layoutStore = useMemo(() => createLayoutStore(), []);
  const skillStore = useMemo(() => createSkillStore(), []);
  const vaultService = useMemo(() => createVaultService(), []);
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [modelAuthBusy, setModelAuthBusy] = useState(false);
  const [modelAuthMessage, setModelAuthMessage] = useState<string | null>(null);
  const [googleAuthBusy, setGoogleAuthBusy] = useState(false);
  const [googleAuthMessage, setGoogleAuthMessage] = useState<string | null>(null);
  const [memorySweepState, setMemorySweepState] = useState<MemoryRunState | null>(null);
  const [memorySweepBusy, setMemorySweepBusy] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [opencode, storedSession] = await Promise.all([
          invoke<OpencodeConnection>('get_opencode_connection'),
          readStoredSession(),
        ]);
        const vaultPath = window.localStorage.getItem(VAULT_PATH_KEY);
        let session = storedSession;

        if (session) {
          try {
            await forwardGoogleAuth(opencode, vaultPath, session);
          } catch (error) {
            console.warn('Stored Google session could not be restored. Continuing in local-only mode.', error);
            await storeSession(null);
            session = null;
          }
        }

        let vaultRevision = 0;
        if (vaultPath) {
          const config = { path: vaultPath, isNew: false };
          await vaultService.init(config);
          await indexVault(config);
          await skillStore.init(vaultPath);
          await skillStore.reindex();
          vaultRevision = 1;
        }

        const modelConnected = await probeModelConnection(opencode, vaultPath);

        if (!active) {
          return;
        }

        setState({
          status: 'ready',
          layoutStore,
          memoryStore,
          skillStore,
          opencode,
          session,
          vaultPath,
          onboarded: window.localStorage.getItem(ONBOARDING_KEY) === '1',
          modelConnected,
          vaultRevision,
          activeSkillsRevision: 0,
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
  }, [layoutStore, memoryStore, skillStore, vaultService]);

  useEffect(() => {
    if (state.status !== 'ready' || !state.vaultPath) {
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
          console.warn('Failed to refresh the vault index after a file change.', error);
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
  }, [state.status, state.status === 'ready' ? state.vaultPath : null, vaultService, skillStore]);

  useEffect(() => {
    if (state.status !== 'ready') {
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
    state.status,
    state.status === 'ready' ? state.modelConnected : false,
    state.status === 'ready' ? state.opencode.baseUrl : null,
    state.status === 'ready' ? state.opencode.username : null,
    state.status === 'ready' ? state.opencode.password : null,
    state.status === 'ready' ? state.vaultPath : null,
  ]);

  if (state.status === 'loading') {
    return (
      <div className="tinker-app">
        <main className="tinker-stage">
          <section className="tinker-card">
            <p className="tinker-eyebrow">Booting</p>
            <h1>Tinker is starting the workspace</h1>
            <p className="tinker-muted">Launching OpenCode, loading your vault state, and restoring local context.</p>
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

  const setVaultPath = async (config: VaultConfig): Promise<void> => {
    await vaultService.init(config);
    await indexVault(config);
    await skillStore.init(config.path);
    await skillStore.reindex();
    window.localStorage.setItem(VAULT_PATH_KEY, config.path);
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
    setModelAuthMessage(null);
    setModelAuthMessage('Waiting for OpenCode to finish the GPT-5.4 sign-in flow…');

    try {
      await connectModelProvider(state.opencode, state.vaultPath);
      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              modelConnected: true,
            },
      );
      setModelAuthMessage('GPT-5.4 is connected through OpenCode.');
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
      await disconnectModelProvider(state.opencode, state.vaultPath);
      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              modelConnected: false,
            },
      );
      setModelAuthMessage('GPT-5.4 has been disconnected.');
    } finally {
      setModelAuthBusy(false);
    }
  };

  const handleGoogleConnect = async (): Promise<void> => {
    setGoogleAuthBusy(true);
    setGoogleAuthMessage('Waiting for the Google sign-in flow to finish…');

    try {
      const nextSession = await invoke<GoogleOAuthSession>('oauth_flow');
      const session = mergeGoogleSession(state.session, nextSession);
      if (session.refreshToken.length === 0) {
        throw new Error('Google sign-in did not return a refresh token. Try connecting again.');
      }

      await forwardGoogleAuth(state.opencode, state.vaultPath, session);
      await storeSession(session);

      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              session,
            },
      );
      setGoogleAuthMessage(`Google is connected as ${session.email}.`);
    } catch (error) {
      setGoogleAuthMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setGoogleAuthBusy(false);
    }
  };

  const handleGoogleDisconnect = async (): Promise<void> => {
    setGoogleAuthBusy(true);
    setGoogleAuthMessage(null);

    try {
      const results = await Promise.allSettled([
        storeSession(null),
        clearGoogleAuth(state.opencode, state.vaultPath),
      ]);
      const remoteClearFailed = results.some((result) => result.status === 'rejected');

      setState((current) =>
        current.status !== 'ready'
          ? current
          : {
              ...current,
              session: null,
            },
      );
      setGoogleAuthMessage(
        remoteClearFailed
          ? 'Google was disconnected locally, but OpenCode could not clear the remote session.'
          : 'Google has been disconnected.',
      );
    } catch (error) {
      setGoogleAuthMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setGoogleAuthBusy(false);
    }
  };

  const handleCreateVault = async (): Promise<void> => {
    await setVaultPath({
      path: await getDefaultVaultPath(),
      isNew: true,
    });
  };

  const handlePickVault = async (): Promise<void> => {
    const vaultPath = await selectVault();
    if (vaultPath) {
      await setVaultPath({ path: vaultPath, isNew: false });
    }
  };

  const finishOnboarding = (): void => {
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

  return (
    <div className="tinker-app">
      {!state.onboarded ? (
        <FirstRun
          modelConnected={state.modelConnected}
          modelAuthBusy={modelAuthBusy}
          modelAuthMessage={modelAuthMessage}
          googleAuthBusy={googleAuthBusy}
          googleAuthMessage={googleAuthMessage}
          session={state.session}
          vaultPath={state.vaultPath}
          onConnectModel={handleConnectModel}
          onConnectGoogle={handleGoogleConnect}
          onCreateVault={handleCreateVault}
          onSelectVault={handlePickVault}
          onContinue={finishOnboarding}
        />
      ) : (
        <Workspace
          key={DEFAULT_USER_ID}
          layoutStore={state.layoutStore}
          memoryStore={state.memoryStore}
          skillStore={state.skillStore}
          modelConnected={state.modelConnected}
          modelAuthBusy={modelAuthBusy}
          modelAuthMessage={modelAuthMessage}
          googleAuthBusy={googleAuthBusy}
          googleAuthMessage={googleAuthMessage}
          opencode={state.opencode}
          session={state.session}
          vaultPath={state.vaultPath}
          vaultRevision={state.vaultRevision}
          activeSkillsRevision={state.activeSkillsRevision}
          memorySweepState={memorySweepState}
          memorySweepBusy={memorySweepBusy}
          onConnectGoogle={handleGoogleConnect}
          onDisconnectGoogle={handleGoogleDisconnect}
          onConnectModel={handleConnectModel}
          onDisconnectModel={handleDisconnectModel}
          onCreateVault={handleCreateVault}
          onSelectVault={handlePickVault}
          onActiveSkillsChanged={handleActiveSkillsChanged}
          onRunMemorySweep={handleRunMemorySweep}
          onMemoryCommitted={handleMemoryCommitted}
        />
      )}
    </div>
  );
};
