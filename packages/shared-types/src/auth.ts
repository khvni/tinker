import type { IntegrationId } from './integrations.js';

export type OktaProfile = {
  userId: string;
  email: string;
  displayName: string;
  groups: string[];
};

export type OktaSession = {
  profile: OktaProfile;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type IntegrationToken = {
  integrationId: IntegrationId;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
};

export type TokenVault = {
  storeOktaSession(session: OktaSession): Promise<void>;
  getOktaSession(): Promise<OktaSession | null>;
  clearOktaSession(): Promise<void>;
  storeIntegrationToken(token: IntegrationToken): Promise<void>;
  getIntegrationToken(id: IntegrationId): Promise<IntegrationToken | null>;
  clearIntegrationToken(id: IntegrationId): Promise<void>;
};

export type AuthService = {
  signIn(): Promise<OktaSession>;
  signOut(): Promise<void>;
  currentSession(): Promise<OktaSession | null>;
  refreshIfNeeded(): Promise<OktaSession | null>;
};
