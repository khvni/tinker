import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SSOStatus } from '@tinker/shared-types';
import {
  ConnectedSettings,
  SettingsConnectionProvider,
  type SettingsConnectionValue,
} from './SettingsConnection.js';

const { mockUseMemoryRootControls } = vi.hoisted(() => ({
  mockUseMemoryRootControls: vi.fn(),
}));

vi.mock('./useMemoryRootControls.js', () => ({
  useMemoryRootControls: mockUseMemoryRootControls,
}));

const EMPTY_SESSIONS: SSOStatus = {
  google: null,
  github: null,
  microsoft: null,
};

const value: SettingsConnectionValue = {
  modelConnected: false,
  modelAuthBusy: false,
  modelAuthMessage: null,
  googleAuthBusy: false,
  googleAuthMessage: null,
  githubAuthBusy: false,
  githubAuthMessage: null,
  microsoftAuthBusy: false,
  microsoftAuthMessage: null,
  sessions: EMPTY_SESSIONS,
  mcpStatus: {},
  vaultPath: null,
  currentUser: {
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    provider: 'google',
  },
  signOutBusy: false,
  signOutMessage: null,
  onConnectModel: vi.fn(async () => undefined),
  onConnectGoogle: vi.fn(async () => undefined),
  onConnectGithub: vi.fn(async () => undefined),
  onConnectMicrosoft: vi.fn(async () => undefined),
  onDisconnectModel: vi.fn(async () => undefined),
  onDisconnectGoogle: vi.fn(async () => undefined),
  onDisconnectGithub: vi.fn(async () => undefined),
  onDisconnectMicrosoft: vi.fn(async () => undefined),
  onCreateVault: vi.fn(async () => undefined),
  onSelectVault: vi.fn(async () => undefined),
  onSignOut: vi.fn(),
};

describe('ConnectedSettings', () => {
  it('renders the unavailable placeholder when no provider is present', () => {
    mockUseMemoryRootControls.mockReturnValue({
      memoryRoot: null,
      memoryRootBusy: false,
      moveProgress: null,
      notice: null,
      changeMemoryRoot: vi.fn(),
    });

    const markup = renderToStaticMarkup(<ConnectedSettings />);

    expect(markup).toContain('Settings unavailable');
  });

  it('renders the account panel when a provider supplies a user', () => {
    mockUseMemoryRootControls.mockReturnValue({
      memoryRoot: '/Users/alice/memory',
      memoryRootBusy: false,
      moveProgress: null,
      notice: null,
      changeMemoryRoot: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <SettingsConnectionProvider value={value}>
        <ConnectedSettings />
      </SettingsConnectionProvider>,
    );

    expect(markup).toContain('Ada Lovelace');
    expect(markup).toContain('Sign out');
  });
});
