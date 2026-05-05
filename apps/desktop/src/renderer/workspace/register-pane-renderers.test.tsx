import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createDefaultWorkspacePreferences,
  type ScheduledJobStore,
  type SSOStatus,
} from '@tinker/shared-types';
import { getRenderer, resetPaneRegistry } from './pane-registry.js';
import { MemoryPaneRuntimeContext } from './memory-pane-runtime.js';
import { registerWorkspacePaneRenderers } from './register-pane-renderers.js';
import {
  SettingsPaneRuntimeContext,
  type SettingsPaneRuntime,
} from './settings-pane-runtime.js';

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

const settingsRuntime: SettingsPaneRuntime = {
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

describe('registerWorkspacePaneRenderers', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('registers settings and memory panes once', () => {
    registerWorkspacePaneRenderers();
    expect(() => registerWorkspacePaneRenderers()).not.toThrow();

    const settingsMarkup = renderToStaticMarkup(
      <SettingsPaneRuntimeContext.Provider value={settingsRuntime}>
        <>{getRenderer('settings')({ kind: 'settings' })}</>
      </SettingsPaneRuntimeContext.Provider>,
    );
    const memoryMarkup = renderToStaticMarkup(
      <MemoryPaneRuntimeContext.Provider value={{ currentUserId: 'local-user' }}>
        <>{getRenderer('memory')({ kind: 'memory' })}</>
      </MemoryPaneRuntimeContext.Provider>,
    );

    expect(settingsMarkup).toContain('Account');
    expect(settingsMarkup).toContain('Model');
    expect(settingsMarkup).toContain('Memory');
    expect(settingsMarkup).toContain('Connections');
    expect(memoryMarkup).toContain('tinker-memory-pane');
    expect(memoryMarkup).toContain('tinker-memory-sidebar');
    expect(memoryMarkup).toContain('Select a memory entry');
  });
});
