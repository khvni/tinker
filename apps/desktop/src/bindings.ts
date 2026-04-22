import { invoke } from '@tauri-apps/api/core';
import type { SSOProvider, SSOSession, SSOStatus } from '@tinker/shared-types';

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export const VAULT_PATH_KEY = 'tinker:vault-path';
export const DEFAULT_USER_ID = 'local-user';
export const REFRESH_TOKEN_PROVIDERS = ['google', 'github', 'microsoft'] as const;

export type AuthProvider = SSOProvider;
export type AuthStatus = SSOStatus;
export type RefreshTokenProvider = (typeof REFRESH_TOKEN_PROVIDERS)[number];
export type OpencodeConnection = {
  baseUrl: string;
  username: string;
  password: string;
};

export type AuthHandle = {
  baseUrl: string;
  pid: number;
};

export function openFolderPicker(): Promise<string> {
  return invoke<string>('open_folder_picker');
}

export function startAuthSidecar(): Promise<AuthHandle> {
  return invoke<AuthHandle>('start_auth_sidecar');
}

export function saveRefreshToken(provider: RefreshTokenProvider, userId: string, token: string): Promise<void> {
  return invoke('save_refresh_token', { provider, userId, token });
}

export function loadRefreshToken(provider: RefreshTokenProvider, userId: string): Promise<string | null> {
  return invoke<string | null>('load_refresh_token', { provider, userId });
}

export function clearRefreshToken(provider: RefreshTokenProvider, userId: string): Promise<void> {
  return invoke('clear_refresh_token', { provider, userId });
}

export function restoreAuthSession(provider: RefreshTokenProvider, userId: string): Promise<SSOSession | null> {
  return invoke<SSOSession | null>('restore_auth_session', { provider, userId });
}

export function stopOpencode(pid: number): Promise<void> {
  return invoke<void>('stop_opencode', { pid });
}
