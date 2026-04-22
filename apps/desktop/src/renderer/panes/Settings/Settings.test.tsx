import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SSOStatus } from '@tinker/shared-types';
import { Settings } from './Settings.js';
import type { AccountUser } from './sections/Account/index.js';

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

const GOOGLE_USER: AccountUser = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  avatarUrl: 'https://example.com/ada.png',
  provider: 'google',
};

type RenderOverrides = {
  currentUser?: AccountUser | null;
  signOutBusy?: boolean;
  signOutMessage?: string | null;
  sessions?: SSOStatus;
  defaultActiveSectionId?: string;
};

const renderSettings = ({
  currentUser = null,
  signOutBusy = false,
  signOutMessage = null,
  sessions = EMPTY_SESSIONS,
  defaultActiveSectionId,
}: RenderOverrides = {}): string =>
  renderToStaticMarkup(
    <Settings
      modelConnected={false}
      modelAuthBusy={false}
      modelAuthMessage={null}
      googleAuthBusy={false}
      googleAuthMessage={null}
      githubAuthBusy={false}
      githubAuthMessage={null}
      microsoftAuthBusy={false}
      microsoftAuthMessage={null}
      sessions={sessions}
      mcpStatus={{}}
      vaultPath={null}
      currentUser={currentUser}
      signOutBusy={signOutBusy}
      signOutMessage={signOutMessage}
      onConnectModel={vi.fn(async () => undefined)}
      onConnectGoogle={vi.fn(async () => undefined)}
      onConnectGithub={vi.fn(async () => undefined)}
      onConnectMicrosoft={vi.fn(async () => undefined)}
      onDisconnectModel={vi.fn(async () => undefined)}
      onDisconnectGoogle={vi.fn(async () => undefined)}
      onDisconnectGithub={vi.fn(async () => undefined)}
      onDisconnectMicrosoft={vi.fn(async () => undefined)}
      onCreateVault={vi.fn(async () => undefined)}
      onSelectVault={vi.fn(async () => undefined)}
      onSignOut={vi.fn()}
      {...(defaultActiveSectionId ? { defaultActiveSectionId } : {})}
    />,
  );

describe('Settings', () => {
  beforeEach(() => {
    mockUseMemoryRootControls.mockReset();
    mockUseMemoryRootControls.mockReturnValue({
      memoryRoot: '/Users/alice/Library/Application Support/Tinker/memory',
      memoryRootBusy: false,
      moveProgress: null,
      notice: null,
      changeMemoryRoot: vi.fn(),
    });
  });

  it('renders progress modal and notice while memory move is running', () => {
    mockUseMemoryRootControls.mockReset();
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

    const markup = renderSettings({ defaultActiveSectionId: 'connections' });

    expect(markup).toContain('Pick an empty folder for the new memory location.');
    expect(markup).toContain('Updating memory folder');
    expect(markup).toContain('Current file: sessions/2026-04-22.md');
    expect(markup).toContain('40% complete');
  });

  it('renders the memory folder row with truncated path tooltip support', () => {
    const markup = renderSettings({ defaultActiveSectionId: 'connections' });

    expect(markup).toContain('Memory folder');
    expect(markup).toContain('Change location…');
    expect(markup).toContain('/Users/alice/Library/Application Support/Tinker/memory');
    expect(markup).toContain('title="/Users/alice/Library/Application Support/Tinker/memory"');
  });

  it('renders account and connections section navigation', () => {
    const markup = renderSettings({ currentUser: GOOGLE_USER });

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Account');
    expect(markup).toContain('Connections');
    expect(markup).toContain('Ada Lovelace');
    expect(markup).toContain('ada@example.com');
    expect(markup).toContain('Sign out');
  });

  it('renders the account sign-out busy state and message', () => {
    const markup = renderSettings({
      currentUser: GOOGLE_USER,
      signOutBusy: true,
      signOutMessage: 'Clearing keychain…',
    });

    expect(markup).toContain('Signing out…');
    expect(markup).toContain('Clearing keychain…');
  });

  it('renders the account empty state when no user is signed in', () => {
    const markup = renderSettings({ currentUser: null });

    expect(markup).toContain('Not signed in');
  });
});
