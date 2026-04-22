import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SkillStore } from '@tinker/shared-types';

const { opencodeMocks } = vi.hoisted(() => ({
  opencodeMocks: {
    selectedModel: undefined as
      | {
          readonly id: string;
          readonly modelId: string;
          readonly providerId: string;
          readonly providerName: string;
          readonly name: string;
          readonly contextWindow: number;
        }
      | undefined,
  },
}));

// Prevent the Chat module from calling the real OpenCode SDK at mount.
// Each test injects a `selectedModel` by tweaking `opencodeMocks.selectedModel`
// before importing <Chat> — but since top-level mocks run once, we instead
// toggle by passing a different `modelOptions` outcome through the mocked
// `buildModelPickerItems` + `findModelOptionById` below.
vi.mock('../../opencode.js', () => {
  return {
    createWorkspaceClient: () => ({
      config: {
        providers: () =>
          Promise.resolve({
            data: { providers: [], default: {} },
          }),
      },
      session: {
        abort: () => Promise.resolve(),
      },
    }),
    getOpencodeDirectory: () => undefined,
    buildModelPickerItems: () =>
      opencodeMocks.selectedModel ? [opencodeMocks.selectedModel] : [],
    findModelOptionById: (
      items: ReadonlyArray<{ id: string }>,
      id: string | undefined,
    ) => items.find((item) => item.id === id),
    pickDefaultModelOptionId: () => opencodeMocks.selectedModel?.id,
  };
});

vi.mock('@tinker/bridge', () => ({
  injectActiveSkills: () => Promise.resolve(),
  injectMemoryContext: () => Promise.resolve(),
  streamSessionEvents: () =>
    (async function* () {
      // no-op
    })(),
  createChatHistoryWriter: () => ({ append: () => Promise.resolve(), close: () => Promise.resolve() }),
  findLatestChatHistorySessionId: () => Promise.resolve(null),
  readChatHistory: () => Promise.resolve([]),
}));

vi.mock('@tinker/memory', () => ({
  appendMemoryCapture: () => Promise.resolve(false),
  createSession: () => Promise.resolve(),
  findLatestSessionForFolder: () => Promise.resolve(null),
  getActiveMemoryPath: () => Promise.resolve('/memory/test-user'),
  subscribeMemoryPathChanged: () => () => undefined,
  updateLastActive: () => Promise.resolve(),
}));

// Import after the mocks are registered.
const { Chat } = await import('./Chat.js');

const noopSkillStore: SkillStore = {
  init: () => Promise.resolve(),
  list: () => Promise.resolve([]),
  get: () => Promise.resolve(null),
  search: () => Promise.resolve([]),
  getActive: () => Promise.resolve([]),
  getRoleProfile: () =>
    Promise.resolve({
      roleLabel: '',
      connectedTools: [],
      frequentedSkills: [],
    }),
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
  activeSkillsRevision: 0,
};

describe('Chat chrome', () => {
  it('renders the chat pane chrome classes — header, log, composer card', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(<Chat {...baseProps} />);

    expect(markup).toContain('tinker-pane tinker-pane--chat');
    expect(markup).toContain('tinker-chat-header');
    expect(markup).toContain('tinker-chat-header__left');
    expect(markup).toContain('tinker-chat-header__right');
    expect(markup).toContain('tinker-chat-log');
    expect(markup).toContain('tinker-composer-card');
    expect(markup).toContain('tinker-composer-card__body');
    expect(markup).toContain('tinker-composer-card__footer');
  });

  it('omits the ContextBadge when no model is selected', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(<Chat {...baseProps} />);
    expect(markup).not.toContain('tk-context-badge');
  });

  it('renders the slot container (hidden via CSS `:empty` when no slot props are passed)', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(<Chat {...baseProps} />);
    expect(markup).toContain('tinker-chat-header__slot');
  });

  it('renders mode toggle + reasoning picker slots when passed', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <Chat
        {...baseProps}
        modeToggleSlot={<span data-testid="mode-toggle">mode</span>}
        reasoningPickerSlot={<span data-testid="reasoning">reasoning</span>}
      />,
    );

    expect(markup).toContain('data-testid="mode-toggle"');
    expect(markup).toContain('data-testid="reasoning"');
  });

  it('renders the EmptyState inside the chat log', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(<Chat {...baseProps} />);
    expect(markup).toContain('No model connected');
    // EmptyState lives inside the chat log wrapper.
    const logIdx = markup.indexOf('tinker-chat-log');
    const titleIdx = markup.indexOf('No model connected');
    expect(logIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(logIdx);
  });

  it('renders the attachment-slot placeholder button disabled inside the composer card footer', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(<Chat {...baseProps} />);
    expect(markup).toContain('Attachments coming soon');
    expect(markup).toContain('aria-label="Attachments coming soon"');
    expect(markup).toContain('disabled=""');
  });
});
