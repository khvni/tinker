// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@tinker/design';
import type { SkillStore } from '@tinker/shared-types';

// Regression for the bug flagged in Playbook review round 1:
// bumping `activeSkillsRevision` after the user toggles / installs a skill
// USED to force the session-reset effect to re-run — which aborts the live
// OpenCode session, wipes the rendered messages, disposes the history writer,
// and rehydrates from disk. That meant every skill toggle nuked the active
// Chat pane mid-session.
//
// After the fix: the reset effect no longer depends on `activeSkillsRevision`;
// re-injection happens lazily in `injectActiveSkillsIfStale` before the next
// prompt. This test asserts the reset behavior (abort + wipe) does NOT fire
// when `activeSkillsRevision` changes.

type MockClient = {
  config: {
    providers: () => Promise<{
      data: { providers: ReadonlyArray<unknown>; default: Record<string, string> };
    }>;
  };
  mcp: {
    status: ReturnType<typeof vi.fn>;
  };
  session: {
    abort: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mocks = vi.hoisted(() => ({
  client: null as MockClient | null,
  findLatestChatHistorySessionId: null as ReturnType<typeof vi.fn> | null,
  getSession: null as ReturnType<typeof vi.fn> | null,
}));

vi.mock('../../opencode.js', () => ({
  createWorkspaceClient: () => mocks.client,
  getOpencodeDirectory: () => undefined,
  buildModelPickerItems: () => [],
  findModelOptionById: () => undefined,
  pickDefaultModelOptionId: () => undefined,
}));

vi.mock('@tinker/bridge', () => ({
  injectActiveSkills: () => Promise.resolve(),
  injectMemoryContext: () => Promise.resolve(),
  streamSessionEvents: () =>
    (async function* () {
      // no-op
    })(),
  createChatHistoryWriter: () => ({
    appendEvent: () => undefined,
    dispose: () => Promise.resolve(),
  }),
  findLatestChatHistorySessionId: (...args: unknown[]) => {
    if (mocks.findLatestChatHistorySessionId) {
      return mocks.findLatestChatHistorySessionId(...args) as Promise<string | null>;
    }
    return Promise.resolve(null);
  },
  readChatHistory: () => Promise.resolve([]),
}));

vi.mock('@tinker/memory', () => ({
  appendMemoryCapture: () => Promise.resolve(false),
  createSession: () => Promise.resolve(),
  findLatestSessionForFolder: () => Promise.resolve(null),
  getSession: (...args: unknown[]) => {
    if (mocks.getSession) {
      return mocks.getSession(...args) as Promise<unknown>;
    }
    return Promise.resolve(null);
  },
  getActiveMemoryPath: () => Promise.resolve('/memory/test-user'),
  listSessionsForUser: () => Promise.resolve([]),
  subscribeMemoryPathChanged: () => () => undefined,
  updateLastActive: () => Promise.resolve(),
  updateSession: () => Promise.resolve(),
  isGitAvailable: () => Promise.resolve(false),
  syncSkills: () => Promise.resolve({ pulled: [], pushed: [], conflicts: [], message: '' }),
  slugify: (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'skill',
  isValidSkillSlug: (value: string) => /^[a-z0-9][a-z0-9-]*$/u.test(value),
}));

// Silence CSS imports.
vi.mock('./components/SaveAsSkillModal/SaveAsSkillModal.css', () => ({}));

const { Chat } = await import('./Chat.js');

const noopSkillStore: SkillStore = {
  init: () => Promise.resolve(),
  list: () => Promise.resolve([]),
  get: () => Promise.resolve(null),
  search: () => Promise.resolve([]),
  getActive: () => Promise.resolve([]),
  getRoleProfile: () =>
    Promise.resolve({ roleLabel: '', connectedTools: [], frequentedSkills: [] }),
  setActive: () => Promise.resolve(),
  installFromFile: () => Promise.reject(new Error('not used')),
  installFromDraft: () => Promise.reject(new Error('not used')),
  uninstall: () => Promise.resolve(),
  reindex: () => Promise.resolve({ skillsIndexed: 0 }),
  getGitConfig: () => Promise.resolve(null),
  setGitConfig: () => Promise.resolve(),
};

const baseProps = {
  skillStore: noopSkillStore,
  currentUserId: 'test-user',
  modelConnected: false,
  opencode: {
    baseUrl: 'http://localhost:0',
    username: 'test',
    password: 'test',
  },
  sessionFolderPath: null,
  vaultPath: null,
  skillsRootPath: null,
  activeSkillsRevision: 0,
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('<Chat> — skill re-inject decoupled from session reset', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.client = {
      config: {
        providers: () => Promise.resolve({ data: { providers: [], default: {} } }),
      },
      mcp: {
        status: vi.fn(() =>
          Promise.resolve({
            data: {
              qmd: { status: 'connected' },
              'smart-connections': { status: 'connected' },
              exa: { status: 'connected' },
            },
          }),
        ),
      },
      session: {
        abort: vi.fn(() => Promise.resolve()),
        create: vi.fn(() => Promise.resolve({ data: { id: 'session-test' } })),
      },
    };
    mocks.findLatestChatHistorySessionId = vi.fn(() => Promise.resolve(null));
    mocks.getSession = vi.fn(() => Promise.resolve(null));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('does NOT re-run the session-reset effect when activeSkillsRevision changes', async () => {
    // Mount with a concrete sessionFolderPath so the session-reset effect
    // actually calls findLatestChatHistorySessionId (which is its best
    // observable side-effect when there is no prior session ID).
    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" activeSkillsRevision={0} />
        </ToastProvider>,
      );
    });
    await flushEffects();

    if (!mocks.client || !mocks.findLatestChatHistorySessionId) {
      throw new Error('mocks not installed');
    }

    const hydrateCallsAfterMount = mocks.findLatestChatHistorySessionId.mock.calls.length;
    expect(hydrateCallsAfterMount).toBeGreaterThanOrEqual(1);

    // Bump revision — before the fix this re-ran the reset effect (which
    // aborts the live session, wipes messages, and re-hydrates from disk).
    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" activeSkillsRevision={1} />
        </ToastProvider>,
      );
    });
    await flushEffects();

    // The session-reset effect must NOT have re-run — the hydrate path is the
    // canonical proxy for "reset effect fired".
    expect(mocks.findLatestChatHistorySessionId.mock.calls.length).toBe(hydrateCallsAfterMount);
    // And no NEW abort call was scheduled from the reset effect.
    expect(mocks.client.session.abort.mock.calls.length).toBe(0);
    // Chat log is still mounted.
    expect(container.querySelector('.tinker-chat-log')).not.toBeNull();

    // Bump again with a different value — still no reset.
    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" activeSkillsRevision={5} />
        </ToastProvider>,
      );
    });
    await flushEffects();

    expect(mocks.findLatestChatHistorySessionId.mock.calls.length).toBe(hydrateCallsAfterMount);
    expect(mocks.client.session.abort.mock.calls.length).toBe(0);
  });

  it('does NOT re-run the session-reset effect when onPersistSessionId changes', async () => {
    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" onPersistSessionId={() => undefined} />
        </ToastProvider>,
      );
    });
    await flushEffects();

    if (!mocks.findLatestChatHistorySessionId) {
      throw new Error('mock not installed');
    }

    const hydrateCallsAfterMount = mocks.findLatestChatHistorySessionId.mock.calls.length;
    expect(hydrateCallsAfterMount).toBeGreaterThanOrEqual(1);

    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" onPersistSessionId={() => undefined} />
        </ToastProvider>,
      );
    });
    await flushEffects();

    expect(mocks.findLatestChatHistorySessionId.mock.calls.length).toBe(hydrateCallsAfterMount);
    expect(mocks.client?.session.abort.mock.calls.length).toBe(0);
  });

  it('does NOT re-run the session-reset effect when paneSessionId is persisted back into props', async () => {
    mocks.findLatestChatHistorySessionId = vi.fn(() => Promise.resolve('restored-session'));
    mocks.getSession = vi.fn(() => Promise.resolve(null));
    const persistSessionId = vi.fn();

    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" onPersistSessionId={persistSessionId} />
        </ToastProvider>,
      );
    });
    await flushEffects();

    expect(persistSessionId).toHaveBeenCalledWith('restored-session');

    if (!mocks.findLatestChatHistorySessionId) {
      throw new Error('mock not installed');
    }

    const hydrateCallsAfterMount = mocks.findLatestChatHistorySessionId.mock.calls.length;
    expect(hydrateCallsAfterMount).toBeGreaterThanOrEqual(1);

    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat
            {...baseProps}
            sessionFolderPath="/vault/a"
            paneSessionId="restored-session"
            onPersistSessionId={persistSessionId}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    expect(mocks.findLatestChatHistorySessionId.mock.calls.length).toBe(hydrateCallsAfterMount);
    expect(mocks.client?.session.abort.mock.calls.length).toBe(0);
  });

  it('DOES re-run the session-reset effect when sessionFolderPath changes (guard: the effect still fires for real triggers)', async () => {
    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/a" />
        </ToastProvider>,
      );
    });
    await flushEffects();

    if (!mocks.findLatestChatHistorySessionId) {
      throw new Error('mock not installed');
    }

    const hydrateCallsA = mocks.findLatestChatHistorySessionId.mock.calls.length;
    expect(hydrateCallsA).toBeGreaterThanOrEqual(1);

    // Switch vault folders — this SHOULD re-run the reset effect.
    await act(async () => {
      root.render(
        <ToastProvider>
          <Chat {...baseProps} sessionFolderPath="/vault/b" />
        </ToastProvider>,
      );
    });
    await flushEffects();

    expect(mocks.findLatestChatHistorySessionId.mock.calls.length).toBeGreaterThan(hydrateCallsA);
  });
});
