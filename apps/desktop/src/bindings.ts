import type { SSOProvider, SSOSession, SSOStatus } from '@tinker/shared-types';
import { getDesktopApi } from './desktop-api.js';
import type {
  AuthHandle,
  DesktopApi,
  OpencodeConnection,
  ProjectMode,
  ProjectState,
  RecentProject,
  RefreshTokenProvider,
} from './desktop-api-types.js';

export type { AuthHandle, OpencodeConnection, ProjectMode, ProjectState, RecentProject, RefreshTokenProvider };

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export const VAULT_PATH_KEY = 'tinker:vault-path';
export const GUEST_USER_ID = 'guest';
export const DEFAULT_USER_ID = GUEST_USER_ID;
export const REFRESH_TOKEN_PROVIDERS = ['google', 'github', 'microsoft'] as const;

export type AuthProvider = SSOProvider;
export type AuthStatus = SSOStatus;

const requireApi = (): DesktopApi => {
  const api = getDesktopApi();
  if (!api) throw new Error('Desktop API unavailable. Use Electron or Tauri shell.');
  return api;
};

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

const getTauriInvoke = async (): Promise<
  (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
> => {
  if (tauriInvoke) return tauriInvoke;
  const { invoke } = await import('@tauri-apps/api/core');
  tauriInvoke = invoke;
  return invoke;
};

const isElectron = (): boolean => getDesktopApi() !== null;

// --- Dialog ---
export async function openFolderPicker(): Promise<string> {
  if (isElectron()) return requireApi().dialog.openFolder();
  const invoke = await getTauriInvoke();
  return invoke('open_folder_picker') as Promise<string>;
}

// --- Shell ---
export async function openExternal(url: string): Promise<void> {
  if (isElectron()) return requireApi().shell.openExternal(url);
  const { open } = await import('@tauri-apps/plugin-shell');
  return open(url);
}

// --- App paths ---
export async function getHomePath(): Promise<string> {
  if (isElectron()) return requireApi().app.getHomePath();
  const { homeDir } = await import('@tauri-apps/api/path');
  return homeDir();
}

export async function joinPath(...segments: string[]): Promise<string> {
  if (isElectron()) return requireApi().app.joinPath(...segments);
  const { join } = await import('@tauri-apps/api/path');
  return join(...segments);
}

// --- Notifications ---
export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (isElectron()) return requireApi().notification.isPermissionGranted();
  const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
  return isPermissionGranted();
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  if (isElectron()) return requireApi().notification.requestPermission();
  const { requestPermission } = await import('@tauri-apps/plugin-notification');
  return requestPermission() as Promise<'granted' | 'denied'>;
}

export async function sendDesktopNotification(payload: { title: string; body: string }): Promise<void> {
  if (isElectron()) return requireApi().notification.send(payload);
  const { sendNotification } = await import('@tauri-apps/plugin-notification');
  sendNotification(payload);
}

// --- Auth ---
export async function startAuthSidecar(): Promise<AuthHandle> {
  if (isElectron()) return requireApi().auth.startSidecar();
  const invoke = await getTauriInvoke();
  return invoke('start_auth_sidecar') as Promise<AuthHandle>;
}

export async function authSignIn(provider: SSOProvider): Promise<SSOSession> {
  if (isElectron()) return requireApi().auth.signIn(provider);
  const invoke = await getTauriInvoke();
  return invoke('auth_sign_in', { provider }) as Promise<SSOSession>;
}

export async function authSignOut(provider: SSOProvider): Promise<void> {
  if (isElectron()) return requireApi().auth.signOut(provider);
  const invoke = await getTauriInvoke();
  return invoke('auth_sign_out', { provider }) as Promise<void>;
}

export async function readAuthStatus(): Promise<SSOStatus> {
  if (isElectron()) return requireApi().auth.status();
  const invoke = await getTauriInvoke();
  return invoke('auth_status') as Promise<SSOStatus>;
}

export async function restoreAuthSession(
  provider: RefreshTokenProvider,
  userId: string,
): Promise<SSOSession | null> {
  if (isElectron()) return requireApi().auth.restoreSession(provider, userId);
  const invoke = await getTauriInvoke();
  return invoke('restore_auth_session', { provider, userId }) as Promise<SSOSession | null>;
}

// --- Keychain ---
export async function saveRefreshToken(
  provider: RefreshTokenProvider,
  userId: string,
  token: string,
): Promise<void> {
  if (isElectron()) return requireApi().keychain.saveRefreshToken(provider, userId, token);
  const invoke = await getTauriInvoke();
  return invoke('save_refresh_token', { provider, userId, token }) as Promise<void>;
}

export async function loadRefreshToken(
  provider: RefreshTokenProvider,
  userId: string,
): Promise<string | null> {
  if (isElectron()) return requireApi().keychain.loadRefreshToken(provider, userId);
  const invoke = await getTauriInvoke();
  return invoke('load_refresh_token', { provider, userId }) as Promise<string | null>;
}

export async function clearRefreshToken(
  provider: RefreshTokenProvider,
  userId: string,
): Promise<void> {
  if (isElectron()) return requireApi().keychain.clearRefreshToken(provider, userId);
  const invoke = await getTauriInvoke();
  return invoke('clear_refresh_token', { provider, userId }) as Promise<void>;
}

export async function saveMcpSecret(mcpId: string, secret: string): Promise<void> {
  if (isElectron()) return requireApi().keychain.saveMcpSecret(mcpId, secret);
  const invoke = await getTauriInvoke();
  return invoke('save_mcp_secret', { mcpId, secret }) as Promise<void>;
}

export async function loadMcpSecret(mcpId: string): Promise<string | null> {
  if (isElectron()) return requireApi().keychain.loadMcpSecret(mcpId);
  const invoke = await getTauriInvoke();
  return invoke('load_mcp_secret', { mcpId }) as Promise<string | null>;
}

export async function clearMcpSecret(mcpId: string): Promise<void> {
  if (isElectron()) return requireApi().keychain.clearMcpSecret(mcpId);
  const invoke = await getTauriInvoke();
  return invoke('clear_mcp_secret', { mcpId }) as Promise<void>;
}

// --- Process lifecycle ---
export async function startOpencode(
  folderPath: string,
  userId: string,
  memorySubdir: string,
): Promise<OpencodeConnection> {
  if (isElectron()) return requireApi().process.startOpencode(folderPath, userId, memorySubdir);
  const invoke = await getTauriInvoke();
  return invoke('start_opencode', { folderPath, userId, memorySubdir }) as Promise<OpencodeConnection>;
}

export async function stopOpencode(pid: number): Promise<void> {
  if (isElectron()) return requireApi().process.stopOpencode(pid);
  const invoke = await getTauriInvoke();
  return invoke('stop_opencode', { pid }) as Promise<void>;
}

// --- Project state ---
export async function getProjectState(): Promise<ProjectState> {
  return requireApi().project.getState();
}

export async function setProjectMode(mode: ProjectMode): Promise<void> {
  return requireApi().project.setMode(mode);
}

export async function addRecentProject(project: RecentProject): Promise<void> {
  return requireApi().project.addRecent(project);
}

export async function removeRecentProject(path: string): Promise<void> {
  return requireApi().project.removeRecent(path);
}

export async function setActiveRoot(root: string): Promise<void> {
  return requireApi().project.setActiveRoot(root);
}
