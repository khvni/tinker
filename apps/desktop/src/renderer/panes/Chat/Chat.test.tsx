import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '@tinker/design';
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
  isGitAvailable: () => Promise.resolve(false),
  syncSkills: () => Promise.resolve({ pulled: [], pushed: [], conflicts: [], message: '' }),
  slugify: (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '') || 'skill',
  isValidSkillSlug: (value: string) => /^[a-z0-9][a-z0-9-]*$/u.test(value),
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
  skillsRootPath: null,
  activeSkillsRevision: 0,
};

describe('Chat chrome', () => {
  it('renders the chat pane chrome classes — log, composer', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );

    expect(markup).toContain('tinker-pane tinker-pane--chat');
    expect(markup).toContain('tinker-chat-log');
    expect(markup).toContain('tk-prompt-composer');
    expect(markup).toContain('tk-prompt-composer__card');
  });

  it('omits the ContextPill when no model is selected', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).not.toContain('tk-context-pill');
  });

  it('renders mode + model + thinking chips in composer bottom row', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).toContain('tk-composer-chip');
    expect(markup).toContain('tk-modelpicker');
    expect(markup).toContain('>Auto Accept<');
    expect(markup).toContain('>Default<');
  });

  it('renders the EmptyState inside the chat log', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).toContain('No model connected');
    const logIdx = markup.indexOf('tinker-chat-log');
    const titleIdx = markup.indexOf('No model connected');
    expect(logIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(logIdx);
  });

  it('renders the attachment placeholder button disabled inside the composer', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).toContain('Attachments coming soon');
    expect(markup).toContain('aria-label="Attachments coming soon"');
    expect(markup).toContain('disabled=""');
  });

  it('renders the send button with an arrow icon', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).toContain('tk-prompt-composer__send');
    expect(markup).toContain('aria-label="Send message"');
  });

  it('renders kebab menu with pane options', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).toContain('aria-label="Pane options"');
  });

  it('renders StatusDot reflecting modelConnected=false', () => {
    opencodeMocks.selectedModel = undefined;
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markup).toContain('tk-statusdot--muted');
  });

  it('per-pane isolation: two Chat mounts do not share busy state', () => {
    opencodeMocks.selectedModel = undefined;
    // Render two independent Chat instances; both should show send button (not stop)
    // because neither has started streaming.
    const markupA = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    const markupB = renderToStaticMarkup(
      <ToastProvider>
        <Chat {...baseProps} />
      </ToastProvider>,
    );
    expect(markupA).toContain('aria-label="Send message"');
    expect(markupB).toContain('aria-label="Send message"');
  });
});
