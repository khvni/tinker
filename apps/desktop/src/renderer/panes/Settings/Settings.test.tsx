import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultWorkspacePreferences, type SSOStatus } from '@tinker/shared-types';
import { Settings } from './Settings.js';

const { mockUseMemoryRootControls } = vi.hoisted(() => ({
  mockUseMemoryRootControls: vi.fn(),
}));

vi.mock('./useMemoryRootControls.js', () => ({
  useMemoryRootControls: mockUseMemoryRootControls,
}));

const EMPTY_SESSIONS: SSOStatus = {
  google: null,
  github: null,
};

describe('Settings', () => {
  beforeEach(() => {
    mockUseMemoryRootControls.mockReset();
  });

  it('renders progress modal and notice while memory move is running', () => {
    mockUseMemoryRootControls.mockReturnValueOnce({
      memoryRoot: '/Users/alice/Library/Application Support/Tinker/memory',
      memoryRootBusy: true,
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
    });

    const markup = renderToStaticMarkup(
      <Settings
        modelConnected={false}
        modelAuthBusy={false}
        modelAuthMessage={null}
        googleAuthBusy={false}
        googleAuthMessage={null}
        githubAuthBusy={false}
        githubAuthMessage={null}
        sessions={EMPTY_SESSIONS}
        mcpStatus={{}}
        vaultPath={null}
        onConnectModel={vi.fn(async () => undefined)}
        onConnectGoogle={vi.fn(async () => undefined)}
        onConnectGithub={vi.fn(async () => undefined)}
        onDisconnectModel={vi.fn(async () => undefined)}
        onDisconnectGoogle={vi.fn(async () => undefined)}
        onDisconnectGithub={vi.fn(async () => undefined)}
        onCreateVault={vi.fn(async () => undefined)}
        onSelectVault={vi.fn(async () => undefined)}
        workspacePreferences={createDefaultWorkspacePreferences()}
        onWorkspacePreferencesChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Pick an empty folder for the new memory location.');
    expect(markup).toContain('Updating memory folder');
    expect(markup).toContain('Current file: sessions/2026-04-22.md');
    expect(markup).toContain('40% complete');
  });

  it('renders the memory folder row with truncated path tooltip support', () => {
    mockUseMemoryRootControls.mockReturnValueOnce({
      memoryRoot: '/Users/alice/Library/Application Support/Tinker/memory',
      memoryRootBusy: false,
      moveProgress: null,
      notice: null,
      changeMemoryRoot: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <Settings
        modelConnected={false}
        modelAuthBusy={false}
        modelAuthMessage={null}
        googleAuthBusy={false}
        googleAuthMessage={null}
        githubAuthBusy={false}
        githubAuthMessage={null}
        sessions={EMPTY_SESSIONS}
        mcpStatus={{}}
        vaultPath={null}
        onConnectModel={vi.fn(async () => undefined)}
        onConnectGoogle={vi.fn(async () => undefined)}
        onConnectGithub={vi.fn(async () => undefined)}
        onDisconnectModel={vi.fn(async () => undefined)}
        onDisconnectGoogle={vi.fn(async () => undefined)}
        onDisconnectGithub={vi.fn(async () => undefined)}
        onCreateVault={vi.fn(async () => undefined)}
        onSelectVault={vi.fn(async () => undefined)}
        workspacePreferences={createDefaultWorkspacePreferences()}
        onWorkspacePreferencesChange={vi.fn()}
      />,
    );

    expect(markup).toContain('Memory folder');
    expect(markup).toContain('Change location…');
    expect(markup).toContain('/Users/alice/Library/Application Support/Tinker/memory');
    expect(markup).toContain('title="/Users/alice/Library/Application Support/Tinker/memory"');
  });
});
