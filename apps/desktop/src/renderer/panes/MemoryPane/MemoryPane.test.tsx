// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategorisedMemoryFiles, MemoryEntryBucket, MemoryMarkdownFile } from '@tinker/memory';
import { FilePaneRuntimeContext } from '../FilePane/file-pane-runtime.js';
import { MemoryPaneRuntimeContext } from '../../workspace/memory-pane-runtime.js';

const memoryPaneTestMocks = vi.hoisted(() => {
  let listener: (() => void) | null = null;
  return {
    emitPathChanged() {
      listener?.();
    },
    listCategorisedMemoryFiles: vi.fn<(userId: string) => Promise<CategorisedMemoryFiles>>(),
    subscribeMemoryPathChanged: vi.fn((next: () => void) => {
      listener = next;
      return () => {
        if (listener === next) {
          listener = null;
        }
      };
    }),
    parseFrontmatter: vi.fn((text: string) => {
      const match = text.match(/^---\n([\s\S]*?)\n---/u);
      if (!match) {
        return { frontmatter: {}, body: text };
      }
      const frontmatter: Record<string, unknown> = {};
      for (const line of match[1]?.split('\n') ?? []) {
        const [key, ...rest] = line.split(':');
        if (key && rest.length > 0) {
          frontmatter[key.trim()] = rest.join(':').trim();
        }
      }
      return { frontmatter, body: text.slice(match[0].length) };
    }),
  };
});

vi.mock('@tinker/memory', () => ({
  listCategorisedMemoryFiles: memoryPaneTestMocks.listCategorisedMemoryFiles,
  subscribeMemoryPathChanged: memoryPaneTestMocks.subscribeMemoryPathChanged,
  parseFrontmatter: memoryPaneTestMocks.parseFrontmatter,
  DEMO_MEMORY_PREVIEW: {
    categorised: {
      rootPath: '/memory/demo',
      buckets: {
        pending: [],
        people: [],
        'active-work': [],
        capabilities: [],
        preferences: [],
        organization: [],
      },
    },
    selection: null,
    markdownByAbsolutePath: {},
  },
  DEMO_MEMORY_REFERENCE_TIME_MS: Date.parse('2026-04-22T14:00:00.000Z'),
  DEMO_MEMORY_SELECTED_RELATIVE_PATH: 'pending/synthesis-auto-20260408-glass-article.md',
  bucketForFrontmatter: (frontmatter: Record<string, unknown>) => {
    const raw = frontmatter.kind;
    if (typeof raw !== 'string') {
      return null;
    }
    const normalized = raw.trim().toLowerCase().replace(/[_\s]+/gu, '-');
    const valid = ['people', 'active-work', 'capabilities', 'preferences', 'organization'];
    return valid.includes(normalized) ? normalized : null;
  },
  MEMORY_CATEGORY_DIRECTORIES: {
    people: 'people',
    'active-work': 'active-work',
    capabilities: 'capabilities',
    preferences: 'preferences',
    organization: 'organization',
  },
  MEMORY_CATEGORY_ORDER: ['people', 'active-work', 'capabilities', 'preferences', 'organization'],
  MEMORY_CATEGORY_LABELS: {
    people: 'People',
    'active-work': 'Active Work',
    capabilities: 'Capabilities',
    preferences: 'Preferences',
    organization: 'Organization',
  },
}));

const { mockReadTextFile, mockRenderMarkdown, mockApprove, mockDismiss, mockDiff } = vi.hoisted(() => ({
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockRenderMarkdown: vi.fn<(text: string) => Promise<string>>(),
  mockApprove: vi.fn<(filePath: string, destinationDir: string) => Promise<string>>(),
  mockDismiss: vi.fn<(filePath: string) => Promise<void>>(),
  mockDiff: vi.fn<(filePath: string) => Promise<string>>(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: mockReadTextFile,
}));

vi.mock('../../renderers/MarkdownRenderer.js', () => ({
  renderMarkdown: mockRenderMarkdown,
}));

vi.mock('./memory-commands.js', () => ({
  approveMemoryEntry: mockApprove,
  dismissMemoryEntry: mockDismiss,
  readMemoryDiff: mockDiff,
}));

vi.mock('../../runtime.js', () => ({
  isTauriRuntime: () => true,
}));

import { MemoryPane } from './MemoryPane.js';

const emptyBuckets = (): Record<MemoryEntryBucket, MemoryMarkdownFile[]> => ({
  pending: [],
  people: [],
  'active-work': [],
  capabilities: [],
  preferences: [],
  organization: [],
});

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const makeFile = (overrides: Partial<MemoryMarkdownFile> = {}): MemoryMarkdownFile => ({
  absolutePath: '/memory/u/pending/alice.md',
  relativePath: 'pending/alice.md',
  name: 'alice.md',
  title: 'Alice',
  modifiedAt: '2026-04-22T14:00:00.000Z',
  category: null,
  displayPath: '/memory/u/pending/alice.md',
  changesPreview: null,
  ...overrides,
});

describe('<MemoryPane>', () => {
  let container: HTMLDivElement;
  let root: Root;
  let openFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    openFile = vi.fn();

    memoryPaneTestMocks.listCategorisedMemoryFiles.mockReset();
    memoryPaneTestMocks.subscribeMemoryPathChanged.mockClear();
    mockReadTextFile.mockReset();
    mockRenderMarkdown.mockReset();
    mockApprove.mockReset();
    mockDismiss.mockReset();
    mockDiff.mockReset();

    mockRenderMarkdown.mockResolvedValue('<p>body</p>');
    mockDiff.mockResolvedValue('');
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
    vi.clearAllMocks();
  });

  const render = async (): Promise<void> => {
    await act(async () => {
      root.render(
        <MemoryPaneRuntimeContext.Provider value={{ currentUserId: 'local-user' }}>
          <FilePaneRuntimeContext.Provider value={{ vaultRevision: 0, openFile }}>
            <MemoryPane />
          </FilePaneRuntimeContext.Provider>
        </MemoryPaneRuntimeContext.Provider>,
      );
    });
    await flushEffects();
  };

  it('renders sidebar sections with counts and auto-selects the first pending entry', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles.mockResolvedValue({
      rootPath: '/memory/u',
      buckets: {
        ...emptyBuckets(),
        pending: [makeFile()],
        people: [
          makeFile({
            absolutePath: '/memory/u/people/khani.md',
            relativePath: 'people/khani.md',
            name: 'khani.md',
            title: 'Khani',
          }),
        ],
      },
    });

    await render();

    expect(container.textContent).toContain('Pending');
    expect(container.textContent).toContain('People');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Update · Pending review');
  });

  it('populates detail pane on pending row click and calls approve with the frontmatter destination', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: { ...emptyBuckets(), pending: [makeFile()] },
      })
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: {
          ...emptyBuckets(),
          people: [
            makeFile({
              relativePath: 'people/alice.md',
              absolutePath: '/memory/u/people/alice.md',
            }),
          ],
        },
      });
    mockReadTextFile.mockResolvedValue('---\nkind: People\n---\n# Alice');
    mockApprove.mockResolvedValue('/memory/u/people/alice.md');

    await render();

    expect(container.textContent).toContain('Update · Pending review');

    const approveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Approve',
    );
    if (!(approveButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Approve button.');
    }
    await act(async () => {
      approveButton.click();
    });
    await flushEffects();

    expect(mockApprove).toHaveBeenCalledWith('/memory/u/pending/alice.md', 'people');
    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
  });

  it('calls dismiss and refreshes when the user dismisses a pending entry', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: { ...emptyBuckets(), pending: [makeFile()] } })
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: emptyBuckets() });
    mockDismiss.mockResolvedValue(undefined);

    await render();

    const row = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alice'),
    );
    if (!(row instanceof HTMLButtonElement)) {
      throw new Error('Expected pending row.');
    }
    await act(async () => {
      row.click();
    });
    await flushEffects();

    const dismissButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Dismiss',
    );
    if (!(dismissButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Dismiss button.');
    }
    await act(async () => {
      dismissButton.click();
    });
    await flushEffects();

    expect(mockDismiss).toHaveBeenCalledWith('/memory/u/pending/alice.md');
    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
  });

  it('refreshes the list when the memory path changes', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: { ...emptyBuckets(), pending: [makeFile()] } })
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: {
          ...emptyBuckets(),
          pending: [
            makeFile({
              name: 'bob.md',
              title: 'Bob',
              absolutePath: '/memory/u/pending/bob.md',
              relativePath: 'pending/bob.md',
            }),
          ],
        },
      });

    await render();

    await act(async () => {
      memoryPaneTestMocks.emitPathChanged();
    });
    await flushEffects();

    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Bob');
  });

  it('prefers the seeded Paper note when present', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles.mockResolvedValue({
      rootPath: '/memory/u',
      buckets: {
        ...emptyBuckets(),
        pending: [
          makeFile({
            absolutePath: '/memory/u/pending/glass.md',
            relativePath: 'pending/glass.md',
            name: 'glass.md',
            title: 'Glass',
          }),
          makeFile({
            absolutePath: '/memory/u/pending/synthesis-auto-20260408-glass-article.md',
            relativePath: 'pending/synthesis-auto-20260408-glass-article.md',
            name: 'synthesis-auto-20260408-glass-article.md',
            title: 'Writing Articles on AI Agents and Software Strategy',
            category: 'active-work',
            displayPath:
              '/Users/seb.goddijn/project-glass/memory/pending/synthesis-auto-20260408-glass-article.md',
            changesPreview: 'seeded diff',
          }),
        ],
      },
    });

    await render();

    expect(container.textContent).toContain('Writing Articles on AI Agents and Software Strategy');
    expect(container.textContent).toContain('Active Work');
  });
});
