export const SSO_PROVIDERS = ['google', 'github', 'microsoft'] as const;

export type SSOProvider = (typeof SSO_PROVIDERS)[number];

export type SSOSession = {
  provider: SSOProvider;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
};

export type SSOConfig = {
  provider: SSOProvider;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  tenantId?: string; // Entra ID only
};

export type SSOService = {
  signIn(): Promise<SSOSession>;
  signOut(): Promise<void>;
  currentSession(): Promise<SSOSession | null>;
  refreshIfNeeded(): Promise<SSOSession | null>;
};

export type SSOStatus = Record<SSOProvider, SSOSession | null>;
