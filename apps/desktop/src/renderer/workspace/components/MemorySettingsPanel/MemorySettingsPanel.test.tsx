import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ScheduledJobStore } from '@tinker/shared-types';
import { createDefaultWorkspacePreferences } from '@tinker/shared-types';
import { MemorySettingsPanel } from './MemorySettingsPanel.js';

const { mockUseMemoryRootControls } = vi.hoisted(() => ({
  mockUseMemoryRootControls: vi.fn(),
}));

vi.mock('./useMemoryRootControls.js', () => ({
  useMemoryRootControls: mockUseMemoryRootControls,
}));

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

const sweepProps = {
  memorySweepState: null,
  memorySweepBusy: false,
  memorySweepCanRun: true,
  memorySweepRevision: 0,
  schedulerStore: stubSchedulerStore,
  onRunMemorySweep: async () => undefined,
};

describe('MemorySettingsPanel', () => {
  beforeEach(() => {
    mockUseMemoryRootControls.mockReset();
  });

  it('renders progress modal and notice while memory move is running', () => {
    mockUseMemoryRootControls.mockReturnValueOnce({
      memoryRoot: '/Users/alice/Library/Application Support/Tinker/memory',
      memoryRootBusy: true,
      memoryAutoAppendEnabled: true,
      memoryAutoAppendBusy: false,
      moveProgress: {
        copiedFiles: 2,
        totalFiles: 5,
        currentPath: 'sessions/2026-04-22.md',
      },
      notice: {
        kind: 'error',
        message: 'Pick an empty folder for the new memory location.',
      },
      changeMemoryRoot: vi.fn(),
      setMemoryAutoAppendEnabled: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <MemorySettingsPanel
        workspacePreferences={createDefaultWorkspacePreferences()}
        onWorkspacePreferencesChange={vi.fn()}
        {...sweepProps}
      />,
    );

    expect(markup).toContain('Pick an empty folder for the new memory location.');
    expect(markup).toContain('Updating memory folder');
    expect(markup).toContain('Current file: sessions/2026-04-22.md');
    expect(markup).toContain('40% complete');
  });

  it('renders memory root and both toggle states', () => {
    mockUseMemoryRootControls.mockReturnValueOnce({
      memoryRoot: '/Users/alice/Library/Application Support/Tinker/memory',
      memoryRootBusy: false,
      memoryAutoAppendEnabled: false,
      memoryAutoAppendBusy: false,
      moveProgress: null,
      notice: null,
      changeMemoryRoot: vi.fn(),
      setMemoryAutoAppendEnabled: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <MemorySettingsPanel
        workspacePreferences={{ ...createDefaultWorkspacePreferences(), autoOpenAgentWrittenFiles: false }}
        onWorkspacePreferencesChange={vi.fn()}
        {...sweepProps}
      />,
    );

    expect(markup).toContain('Memory folder');
    expect(markup).toContain('Change location…');
    expect(markup).toContain('/Users/alice/Library/Application Support/Tinker/memory');
    expect(markup).toContain('title="/Users/alice/Library/Application Support/Tinker/memory"');
    expect(markup).toContain('Automatic memory capture: Off');
    expect(markup).toContain('Auto-open agent-written files: Off');
  });
});
