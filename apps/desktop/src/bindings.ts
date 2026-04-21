import { invoke } from '@tauri-apps/api/core';
import type { SSOProvider, SSOStatus } from '@tinker/shared-types';

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export const ONBOARDING_KEY = 'tinker:onboarded';
export const VAULT_PATH_KEY = 'tinker:vault-path';
export const DEFAULT_USER_ID = 'local-user';

export type AuthProvider = SSOProvider;
export type AuthStatus = SSOStatus;
export type OpencodeConnection = {
  baseUrl: string;
  username: string;
  password: string;
};

export function openFolderPicker(): Promise<string> {
  return invoke<string>('open_folder_picker');
}
