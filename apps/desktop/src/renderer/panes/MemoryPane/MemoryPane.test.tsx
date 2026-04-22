// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CategorisedMemoryFiles,
  MemoryCategoryId,
  MemoryEntryBucket,
  MemoryMarkdownFile,
} from '@tinker/memory';
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
  isMemoryCategoryId: (value: string): value is MemoryCategoryId => {
    const valid = ['People', 'Active Work', 'Capabilities', 'Preferences', 'Organization'];
    return valid.includes(value);
  },
  MEMORY_CATEGORY_ORDER: ['People', 'Active Work', 'Capabilities', 'Preferences', 'Organization'],
  PENDING_MEMORY_CATEGORY: 'Pending',
}));

const { mockReadTextFile, mockWriteTextFile, mockRenderMarkdown, mockApprove, mockDismiss, mockDiff } =
  vi.hoisted(() => ({
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockWriteTextFile: vi.fn<(path: string, contents: string) => Promise<void>>(),
  mockRenderMarkdown: vi.fn<(text: string) => Promise<string>>(),
  mockApprove: vi.fn<(filePath: string, destinationDir: string) => Promise<string>>(),
  mockDismiss: vi.fn<(filePath: string) => Promise<void>>(),
  mockDiff: vi.fn<(filePath: string) => Promise<string>>(),
  }));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: mockReadTextFile,
  writeTextFile: mockWriteTextFile,
}));

vi.mock('../../renderers/MarkdownRenderer.js', () => ({
  renderMarkdown: mockRenderMarkdown,
}));

vi.mock('./memory-commands.js', () => ({
  approveMemoryEntry: mockApprove,
  dismissMemoryEntry: mockDismiss,
  readMemoryDiff: mockDiff,
}));

import { MemoryPane } from './MemoryPane.js';

const emptyBuckets = (): Record<MemoryEntryBucket, MemoryMarkdownFile[]> => ({
  Pending: [],
  People: [],
  'Active Work': [],
  Capabilities: [],
  Preferences: [],
  Organization: [],
});

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const updateTextareaValue = async (
  textarea: HTMLTextAreaElement,
  value: string,
): Promise<void> => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  const setValue = descriptor?.set;
  if (!setValue) {
    throw new Error('Expected textarea value setter.');
  }

  await act(async () => {
    setValue.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const makeFile = (overrides: Partial<MemoryMarkdownFile> = {}): MemoryMarkdownFile => ({
  absolutePath: '/memory/u/Pending/alice.md',
  relativePath: 'Pending/alice.md',
  name: 'alice.md',
  modifiedAt: '2026-04-22T14:00:00.000Z',
  ...overrides,
});

describe('<MemoryPane>', () => {
  let container: HTMLDivElement;
  let root: Root;
  let diskContents: string;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    diskContents = '# Alice';

    memoryPaneTestMocks.listCategorisedMemoryFiles.mockReset();
    memoryPaneTestMocks.subscribeMemoryPathChanged.mockClear();
    mockReadTextFile.mockReset();
    mockWriteTextFile.mockReset();
    mockRenderMarkdown.mockReset();
    mockApprove.mockReset();
    mockDismiss.mockReset();
    mockDiff.mockReset();

    mockReadTextFile.mockImplementation(async () => diskContents);
    mockWriteTextFile.mockImplementation(async (_path, contents) => {
      diskContents = contents;
    });
    mockRenderMarkdown.mockImplementation(async (text) => `<p>${text}</p>`);
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
          <MemoryPane />
        </MemoryPaneRuntimeContext.Provider>,
      );
    });
    await flushEffects();
  };

  it('renders sidebar sections with counts and a selection-empty detail pane', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles.mockResolvedValue({
      rootPath: '/memory/u',
      buckets: {
        ...emptyBuckets(),
        Pending: [makeFile()],
        People: [makeFile({ absolutePath: '/memory/u/People/khani.md', relativePath: 'People/khani.md', name: 'khani.md' })],
      },
    });

    await render();

    expect(container.textContent).toContain('Pending');
    expect(container.textContent).toContain('People');
    expect(container.textContent).toContain('alice.md');
    expect(container.textContent).toContain('Select a memory entry');
  });

  it('populates detail pane on pending row click and calls approve with the frontmatter destination', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: { ...emptyBuckets(), Pending: [makeFile()] },
      })
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: { ...emptyBuckets(), People: [makeFile({ relativePath: 'People/alice.md', absolutePath: '/memory/u/People/alice.md' })] },
      });
    mockReadTextFile.mockResolvedValue('---\nkind: People\n---\n# Alice');
    mockApprove.mockResolvedValue('/memory/u/People/alice.md');

    await render();

    const aliceRow = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('alice.md'),
    );
    if (!(aliceRow instanceof HTMLButtonElement)) {
      throw new Error('Expected alice row to render.');
    }
    await act(async () => {
      aliceRow.click();
    });
    await flushEffects();

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

    expect(mockApprove).toHaveBeenCalledWith('/memory/u/Pending/alice.md', 'People');
    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
  });

  it('calls dismiss and refreshes when the user dismisses a pending entry', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: { ...emptyBuckets(), Pending: [makeFile()] } })
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: emptyBuckets() });
    mockDismiss.mockResolvedValue(undefined);

    await render();

    const row = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('alice.md'),
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

    expect(mockDismiss).toHaveBeenCalledWith('/memory/u/Pending/alice.md');
    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
  });

  it('refreshes the list when the memory path changes', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: { ...emptyBuckets(), Pending: [makeFile()] } })
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: { ...emptyBuckets(), Pending: [makeFile({ name: 'bob.md', absolutePath: '/memory/u/Pending/bob.md', relativePath: 'Pending/bob.md' })] },
      });

    await render();

    await act(async () => {
      memoryPaneTestMocks.emitPathChanged();
    });
    await flushEffects();

    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('bob.md');
  });

  it('reloads memory after save and keeps the same file selected', async () => {
    memoryPaneTestMocks.listCategorisedMemoryFiles
      .mockResolvedValueOnce({ rootPath: '/memory/u', buckets: { ...emptyBuckets(), Pending: [makeFile()] } })
      .mockResolvedValueOnce({
        rootPath: '/memory/u',
        buckets: {
          ...emptyBuckets(),
          Pending: [makeFile({ modifiedAt: '2026-04-22T15:00:00.000Z' })],
        },
      });

    await render();

    const row = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('alice.md'),
    );
    if (!(row instanceof HTMLButtonElement)) {
      throw new Error('Expected pending row.');
    }
    await act(async () => {
      row.click();
    });
    await flushEffects();

    const editButton = container.querySelector('button[aria-label="Edit"]');
    if (!(editButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Edit button.');
    }
    await act(async () => {
      editButton.click();
    });
    await flushEffects();

    const textarea = container.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected inline editor.');
    }
    await updateTextareaValue(textarea, '# Updated note');
    await flushEffects();

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save',
    );
    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Save button.');
    }
    await act(async () => {
      saveButton.click();
    });
    await flushEffects();

    expect(mockWriteTextFile).toHaveBeenCalledWith('/memory/u/Pending/alice.md', '# Updated note');
    expect(memoryPaneTestMocks.listCategorisedMemoryFiles).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.tinker-memory-sidebar__row--selected')?.textContent).toContain('alice.md');
    expect(container.textContent).toContain('Read mode');
    expect(container.textContent).toContain('Updated note');
  });
});
