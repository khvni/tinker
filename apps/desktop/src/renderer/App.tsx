import { useEffect, useMemo, useState, type JSX } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { createLayoutStore, createMemoryStore, createVaultService, indexVault } from '@tinker/memory';
import type { LayoutStore, MemoryStore, SSOSession, VaultConfig } from '@tinker/shared-types';
import { deletePassword, getPassword, setPassword } from 'tauri-plugin-keyring-api';
import {
  CODEX_TOKEN_ACCOUNT,
  DEFAULT_USER_ID,
  GOOGLE_SESSION_ACCOUNT,
  KEYRING_SERVICE,
  ONBOARDING_KEY,
  VAULT_PATH_KEY,
  type GoogleOAuthSession,
} from '../bindings.js';
import { FirstRun } from './panes/FirstRun.js';
import { Workspace } from './workspace/Workspace.js';

type AppState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      layoutStore: LayoutStore;
      memoryStore: MemoryStore;
      opencodeUrl: string;
      session: SSOSession | null;
      vaultPath: string | null;
      onboarded: boolean;
    };

type StoredCodexAuth = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  accountId?: string;
};

const OPENCODE_OPENAI_PROVIDER_ID = 'openai';

const readStoredSession = async (): Promise<SSOSession | null> => {
  const raw = await getPassword(KEYRING_SERVICE, GOOGLE_SESSION_ACCOUNT);
  return raw ? (JSON.parse(raw) as SSOSession) : null;
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

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return null;
  }
};

const parseJwtPayload = (accessToken: string): Record<string, unknown> => {
  const payload = accessToken.split('.')[1];
  if (!payload) {
    return {};
  }

  const decoded = decodeBase64Url(payload);
  if (!decoded) {
    return {};
  }

  try {
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const deriveCodexAuth = (accessToken: string, refreshToken = '', expiresAt?: string, accountId?: string): StoredCodexAuth => {
  const payload = parseJwtPayload(accessToken);
  const exp = typeof payload.exp === 'number' ? payload.exp : Math.floor(Date.now() / 1000) + 3600;
  const authClaims =
    payload['https://api.openai.com/auth'] && typeof payload['https://api.openai.com/auth'] === 'object'
      ? (payload['https://api.openai.com/auth'] as Record<string, unknown>)
      : null;
  const resolvedAccountId =
    accountId ??
    (typeof authClaims?.chatgpt_account_id === 'string' ? authClaims.chatgpt_account_id : undefined);

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt ?? new Date(exp * 1000).toISOString(),
    ...(resolvedAccountId ? { accountId: resolvedAccountId } : {}),
  };
};

const parseStoredCodexAuth = (raw: string): StoredCodexAuth => {
  if (!raw.trim().startsWith('{')) {
    return deriveCodexAuth(raw);
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (typeof parsed.accessToken === 'string') {
    return deriveCodexAuth(
      parsed.accessToken,
      typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
      typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined,
      typeof parsed.accountId === 'string' ? parsed.accountId : undefined,
    );
  }

  if (typeof parsed.access === 'string') {
    return deriveCodexAuth(
      parsed.access,
      typeof parsed.refresh === 'string' ? parsed.refresh : '',
      typeof parsed.expires === 'number' ? new Date(parsed.expires).toISOString() : undefined,
      typeof parsed.accountId === 'string' ? parsed.accountId : undefined,
    );
  }

  throw new Error('Stored Codex auth payload is invalid.');
};

const readStoredCodexAuth = async (): Promise<StoredCodexAuth | null> => {
  const raw = await getPassword(KEYRING_SERVICE, CODEX_TOKEN_ACCOUNT);
  return raw ? parseStoredCodexAuth(raw) : null;
};

const storeCodexAuth = async (auth: StoredCodexAuth | null): Promise<void> => {
  if (!auth) {
    await deletePassword(KEYRING_SERVICE, CODEX_TOKEN_ACCOUNT);
    return;
  }

  await setPassword(KEYRING_SERVICE, CODEX_TOKEN_ACCOUNT, JSON.stringify(auth));
};

const selectVault = async (): Promise<string | null> => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select your Tinker vault',
  });

  return typeof selected === 'string' ? selected : null;
};

const forwardGoogleAuth = async (opencodeUrl: string, session: SSOSession): Promise<void> => {
  const client = createOpencodeClient({ baseUrl: opencodeUrl });

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

const forwardCodexAuth = async (opencodeUrl: string, auth: StoredCodexAuth): Promise<void> => {
  const client = createOpencodeClient({ baseUrl: opencodeUrl });
  const oauthAuth =
    auth.accountId !== undefined
      ? {
          type: 'oauth' as const,
          access: auth.accessToken,
          refresh: auth.refreshToken,
          expires: Date.parse(auth.expiresAt),
          accountId: auth.accountId,
        }
      : {
          type: 'oauth' as const,
          access: auth.accessToken,
          refresh: auth.refreshToken,
          expires: Date.parse(auth.expiresAt),
        };

  await client.auth.set({
    providerID: OPENCODE_OPENAI_PROVIDER_ID,
    auth: oauthAuth,
  });
};

export const App = (): JSX.Element => {
  const memoryStore = useMemo(() => createMemoryStore(), []);
  const layoutStore = useMemo(() => createLayoutStore(), []);
  const vaultService = useMemo(() => createVaultService(), []);
  const [state, setState] = useState<AppState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [opencodeUrl, session, storedCodexAuth] = await Promise.all([
          invoke<string>('get_opencode_url'),
          readStoredSession(),
          readStoredCodexAuth(),
        ]);
        const vaultPath = window.localStorage.getItem(VAULT_PATH_KEY);

        if (session) {
          await forwardGoogleAuth(opencodeUrl, session);
        }

        if (storedCodexAuth) {
          await forwardCodexAuth(opencodeUrl, storedCodexAuth);
        } else {
          try {
            const accessToken = await invoke<string>('codex_oauth_flow');
            const nextCodexAuth = deriveCodexAuth(accessToken);
            await storeCodexAuth(nextCodexAuth);
            await forwardCodexAuth(opencodeUrl, nextCodexAuth);
          } catch (error) {
            console.warn('Codex OAuth was not configured during boot.', error);
          }
        }

        if (vaultPath) {
          const config = { path: vaultPath, isNew: false };
          await vaultService.init(config);
          await indexVault(config);
        }

        if (!active) {
          return;
        }

        setState({
          status: 'ready',
          layoutStore,
          memoryStore,
          opencodeUrl,
          session,
          vaultPath,
          onboarded: window.localStorage.getItem(ONBOARDING_KEY) === '1',
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
    setState((current) =>
      current.status !== 'ready'
        ? current
        : {
            ...current,
            vaultPath: config.path,
          },
    );
  };

  const handleGoogleConnect = async (): Promise<void> => {
    const session = await invoke<GoogleOAuthSession>('oauth_flow');
    await storeSession(session);
    await forwardGoogleAuth(state.opencodeUrl, session);

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
          session={state.session}
          vaultPath={state.vaultPath}
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
          opencodeUrl={state.opencodeUrl}
          session={state.session}
          vaultPath={state.vaultPath}
          onConnectGoogle={handleGoogleConnect}
          onDisconnectGoogle={handleGoogleDisconnect}
          onCreateVault={handleCreateVault}
          onSelectVault={handlePickVault}
        />
      )}
    </div>
  );
};
