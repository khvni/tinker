import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createDefaultWorkspacePreferences,
  type ScheduledJobStore,
  type SSOStatus,
} from '@tinker/shared-types';
import { SettingsPane } from './SettingsPane.js';
import {
  SettingsPaneRuntimeContext,
  type SettingsPaneRuntime,
} from '../../settings-pane-runtime.js';

const emptySessions: SSOStatus = { google: null, github: null, microsoft: null };

const stubSchedulerStore: ScheduledJobStore = {
  listJobs: async () => [],
  getJob: async () => null,
  saveJob: async () => undefined,
  deleteJob: async () => undefined,
  listDueJobs: async () => [],
  recordRun: async () => undefined,
  listRuns: async () => [],
  listTodayEntries: async () => [],
};

const baseRuntime: SettingsPaneRuntime = {
  nativeRuntimeAvailable: true,
  currentUserName: 'Guest',
  currentUserProvider: 'local',
  currentUserEmail: null,
  currentUserAvatarUrl: null,
  sessions: emptySessions,
  activeSession: null,
  signOutBusy: false,
  signOutMessage: null,
  guestBusy: false,
  guestMessage: null,
  providerBusy: { google: false, github: false, microsoft: false },
  providerMessages: { google: null, github: null, microsoft: null },
  modelConnected: false,
  modelAuthBusy: false,
  modelAuthMessage: null,
  workspacePreferences: createDefaultWorkspacePreferences(),
  opencode: null,
  vaultPath: null,
  mcpSeedStatuses: {},
  memorySweepState: null,
  memorySweepBusy: false,
  memorySweepCanRun: false,
  memorySweepRevision: 0,
  schedulerStore: stubSchedulerStore,
  onRunMemorySweep: vi.fn().mockResolvedValue(undefined),
  pendingSectionId: null,
  onPendingSectionConsumed: vi.fn(),
  onSignOut: vi.fn().mockResolvedValue(undefined),
  onContinueAsGuest: vi.fn().mockResolvedValue(undefined),
  onConnectGoogle: vi.fn().mockResolvedValue(undefined),
  onConnectGithub: vi.fn().mockResolvedValue(undefined),
  onConnectMicrosoft: vi.fn().mockResolvedValue(undefined),
  onConnectModel: vi.fn().mockResolvedValue(undefined),
  onDisconnectModel: vi.fn().mockResolvedValue(undefined),
  onWorkspacePreferencesChange: vi.fn(),
  onRequestRespawn: vi.fn().mockResolvedValue(undefined),
};

const renderWithRuntime = (overrides: Partial<SettingsPaneRuntime>): string => {
  return renderToStaticMarkup(
    <SettingsPaneRuntimeContext.Provider value={{ ...baseRuntime, ...overrides }}>
      <SettingsPane />
    </SettingsPaneRuntimeContext.Provider>,
  );
};

describe('SettingsPane', () => {
  it('renders Account, Model, Memory, and Connections sections from runtime context', () => {
    const markup = renderWithRuntime({});

    expect(markup).toContain('Settings');
    expect(markup).toContain('Account');
    expect(markup).toContain('Model');
    expect(markup).toContain('Memory');
    expect(markup).toContain('Connections');
    expect(markup).toContain('Continue as guest');
    expect(markup).toContain('Continue with GitHub');
  });

  it('renders the signed-in account state for the active session', () => {
    const activeSession = {
      provider: 'google' as const,
      userId: 'u-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: '2030-01-01T00:00:00.000Z',
      scopes: [],
    };

    const markup = renderWithRuntime({
      currentUserName: 'Ada Lovelace',
      currentUserProvider: 'google',
      currentUserEmail: 'ada@example.com',
      sessions: { google: activeSession, github: null, microsoft: null },
      activeSession,
    });

    expect(markup).toContain('Signed in');
    expect(markup).toContain('Ada Lovelace');
    expect(markup).toContain('ada@example.com');
  });

  it('throws when rendered without a runtime provider', () => {
    expect(() => renderToStaticMarkup(<SettingsPane />)).toThrow(/Settings pane runtime is missing/);
  });
});
