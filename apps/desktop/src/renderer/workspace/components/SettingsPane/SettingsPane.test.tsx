import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SSOStatus } from '@tinker/shared-types';
import { SettingsPaneRuntimeContext, type SettingsPaneRuntime } from '../../settings-pane-runtime.js';
import { SettingsPane } from './SettingsPane.js';

const emptySessions: SSOStatus = { google: null, github: null, microsoft: null };

const renderWithRuntime = (runtime: SettingsPaneRuntime): string => {
  return renderToStaticMarkup(
    <SettingsPaneRuntimeContext.Provider value={runtime}>
      <SettingsPane />
    </SettingsPaneRuntimeContext.Provider>,
  );
};

describe('SettingsPane', () => {
  const baseRuntime = {
    opencode: null,
    vaultPath: null,
    mcpSeedStatuses: {},
    onRequestRespawn: vi.fn().mockResolvedValue(undefined),
  } as const;

  it('renders the Account section rail entry', () => {
    const runtime: SettingsPaneRuntime = {
      sessions: emptySessions,
      activeSession: null,
      signOutBusy: false,
      signOutMessage: null,
      onSignOut: vi.fn(),
      ...baseRuntime,
    };

    const markup = renderWithRuntime(runtime);

    expect(markup).toContain('Account');
    expect(markup).toContain('Not signed in');
  });

  it('renders the signed-in identity card for the active session', () => {
    const runtime: SettingsPaneRuntime = {
      sessions: emptySessions,
      activeSession: {
        provider: 'google',
        userId: 'u-1',
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        accessToken: '',
        refreshToken: '',
        expiresAt: new Date().toISOString(),
        scopes: [],
      },
      signOutBusy: false,
      signOutMessage: null,
      onSignOut: vi.fn(),
      ...baseRuntime,
    };

    const markup = renderWithRuntime(runtime);

    expect(markup).toContain('Ada Lovelace');
    expect(markup).toContain('ada@example.com');
    expect(markup).toContain('Google');
    expect(markup).toContain('Sign out');
  });

  it('throws when rendered without a runtime provider', () => {
    expect(() => renderToStaticMarkup(<SettingsPane />)).toThrow(/Settings pane runtime is missing/);
  });
});
