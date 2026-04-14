import { useEffect, useMemo, useState, type JSX } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { createLayoutStore, createMemoryStore, createVaultService, indexVault } from '@tinker/memory';
import type { LayoutStore, MemoryStore, SSOSession, VaultConfig } from '@tinker/shared-types';
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
import { FirstRun } from './panes/FirstRun.js';
import { createWorkspaceClient, getOpencodeDirectory, OPENCODE_OPENAI_PROVIDER_ID } from './opencode.js';
import { Workspace } from './workspace/Workspace.js';

type ReadyAppState = {
  status: 'ready';
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  opencode: OpencodeConnection;
  session: SSOSession | null;
  vaultPath: string | null;
  onboarded: boolean;
  modelConnected: boolean;
  vaultRevision: number;
};

type AppState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ReadyAppState;

const MODEL_CONNECT_POLL_INTERVAL_MS = 1_500;
const MODEL_CONNECT_TIMEOUT_MS = 180_000;
const VAULT_REINDEX_DEBOUNCE_MS = 300;

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
    return JSON.parse(raw) as SSOSession;
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

  await client.auth.set({
    providerID: 'google',
    auth: {
      type: 'oauth',
      access: session.accessToken,
      refresh: session.refreshToken,
      expires: Date.parse(session.expiresAt),
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

  await openExternal(authorization.url);

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
  const vaultService = useMemo(() => createVaultService(), []);
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [modelAuthBusy, setModelAuthBusy] = useState(false);
  const [modelAuthMessage, setModelAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [opencode, session] = await Promise.all([
          invoke<OpencodeConnection>('get_opencode_connection'),
          readStoredSession(),
        ]);
        const vaultPath = window.localStorage.getItem(VAULT_PATH_KEY);

        if (session) {
          await forwardGoogleAuth(opencode, vaultPath, session);
        }

        let vaultRevision = 0;
        if (vaultPath) {
          const config = { path: vaultPath, isNew: false };
          await vaultService.init(config);
          await indexVault(config);
          vaultRevision = 1;
        }

        const modelConnected = await isModelConnected(opencode, vaultPath);

        if (!active) {
          return;
        }

        setState({
          status: 'ready',
          layoutStore,
          memoryStore,
          opencode,
          session,
          vaultPath,
          onboarded: window.localStorage.getItem(ONBOARDING_KEY) === '1',
          modelConnected,
          vaultRevision,
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
  }, [layoutStore, memoryStore, vaultService]);

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

    const unsubscribe = vaultService.watch((changedPath) => {
      if (!changedPath.toLowerCase().endsWith('.md')) {
        return;
      }

      scheduleIndex();
    });

    return () => {
      active = false;
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }
      unsubscribe();
    };
  }, [state.status, state.status === 'ready' ? state.vaultPath : null, vaultService]);

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
    window.localStorage.setItem(VAULT_PATH_KEY, config.path);
    const modelConnected = await isModelConnected(state.opencode, config.path);

    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            vaultPath: config.path,
            modelConnected,
            vaultRevision: current.vaultRevision + 1,
          },
    );
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
    const session = await invoke<GoogleOAuthSession>('oauth_flow');
    await storeSession(session);
    await forwardGoogleAuth(state.opencode, state.vaultPath, session);

    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            session,
          },
    );
  };

  const handleGoogleDisconnect = async (): Promise<void> => {
    await storeSession(null);
    try {
      await clearGoogleAuth(state.opencode, state.vaultPath);
    } catch (error) {
      console.warn('Failed to clear Google auth from OpenCode.', error);
    }
    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            session: null,
          },
    );
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
          modelConnected={state.modelConnected}
          modelAuthBusy={modelAuthBusy}
          modelAuthMessage={modelAuthMessage}
          opencode={state.opencode}
          session={state.session}
          vaultPath={state.vaultPath}
          vaultRevision={state.vaultRevision}
          onConnectGoogle={handleGoogleConnect}
          onDisconnectGoogle={handleGoogleDisconnect}
          onConnectModel={handleConnectModel}
          onDisconnectModel={handleDisconnectModel}
          onCreateVault={handleCreateVault}
          onSelectVault={handlePickVault}
        />
      )}
    </div>
  );
};
