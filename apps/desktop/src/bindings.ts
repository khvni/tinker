import type { SSOSession } from '@tinker/shared-types';

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export const KEYRING_SERVICE = 'tinker';
export const GOOGLE_SESSION_ACCOUNT = 'google-session';
export const ONBOARDING_KEY = 'tinker:onboarded';
export const VAULT_PATH_KEY = 'tinker:vault-path';
export const DEFAULT_USER_ID = 'local-user';

export type GoogleOAuthSession = SSOSession;
export type OpencodeConnection = {
  baseUrl: string;
  username: string;
  password: string;
};
