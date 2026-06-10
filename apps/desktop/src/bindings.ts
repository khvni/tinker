import { invoke } from './renderer/electron-shims.js';
import type { SSOProvider, SSOSession, SSOStatus } from '@tinker/shared-types';

export const VAULT_PATH_KEY = 'tinker:vault-path';
export const GUEST_USER_ID = 'guest';
export const DEFAULT_USER_ID = GUEST_USER_ID;

export type AuthProvider = SSOProvider;
export type AuthStatus = SSOStatus;
export type RefreshTokenProvider = 'google' | 'github' | 'microsoft';
export type OpencodeConnection = {
  baseUrl: string;
  username: string;
  password: string;
  pid?: number;
};

export function openFolderPicker(): Promise<string> {
  return invoke<string>('open_folder_picker');
}

export function saveMcpSecret(mcpId: string, secret: string): Promise<void> {
  return invoke('save_mcp_secret', { mcpId, secret });
}

export function clearMcpSecret(mcpId: string): Promise<void> {
  return invoke('clear_mcp_secret', { mcpId });
}

export function restoreAuthSession(provider: RefreshTokenProvider, userId: string): Promise<SSOSession | null> {
  return invoke<SSOSession | null>('restore_auth_session', { provider, userId });
}
