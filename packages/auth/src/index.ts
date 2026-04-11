import type { AuthService, TokenVault } from '@ramp-glass/shared-types';

export const createTokenVault = (_config: { serviceName: string }): TokenVault => {
  return {
    storeOktaSession: async () => {
      throw new Error('tokenVault.storeOktaSession: not yet implemented — see tasks/auth.md');
    },
    getOktaSession: async () => {
      throw new Error('tokenVault.getOktaSession: not yet implemented — see tasks/auth.md');
    },
    clearOktaSession: async () => {
      throw new Error('tokenVault.clearOktaSession: not yet implemented — see tasks/auth.md');
    },
    storeIntegrationToken: async () => {
      throw new Error('tokenVault.storeIntegrationToken: not yet implemented — see tasks/auth.md');
    },
    getIntegrationToken: async () => {
      throw new Error('tokenVault.getIntegrationToken: not yet implemented — see tasks/auth.md');
    },
    clearIntegrationToken: async () => {
      throw new Error('tokenVault.clearIntegrationToken: not yet implemented — see tasks/auth.md');
    },
  };
};

export const createOktaAuthService = (_config: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  vault: TokenVault;
}): AuthService => {
  return {
    signIn: async () => {
      throw new Error('authService.signIn: not yet implemented — see tasks/auth.md');
    },
    signOut: async () => {
      throw new Error('authService.signOut: not yet implemented — see tasks/auth.md');
    },
    currentSession: async () => {
      throw new Error('authService.currentSession: not yet implemented — see tasks/auth.md');
    },
    refreshIfNeeded: async () => {
      throw new Error('authService.refreshIfNeeded: not yet implemented — see tasks/auth.md');
    },
  };
};
