// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilePaneRuntimeContext } from '../FilePane/file-pane-runtime.js';
import { MemoryPaneRuntimeContext } from '../../workspace/memory-pane-runtime.js';

const memoryPaneTestMocks = vi.hoisted(() => {
  let listener: (() => void) | null = null;

  return {
    emitPathChanged() {
      listener?.();
    },
    listMemoryMarkdownFiles: vi.fn<
      (userId: string) => Promise<Array<{ absolutePath: string; relativePath: string; name: string; modifiedAt: string }>>
    >(),
    subscribeMemoryPathChanged: vi.fn((nextListener: () => void) => {
      listener = nextListener;
      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    }),
  };
});

vi.mock('@tinker/memory', () => ({
  listMemoryMarkdownFiles: memoryPaneTestMocks.listMemoryMarkdownFiles,
  subscribeMemoryPathChanged: memoryPaneTestMocks.subscribeMemoryPathChanged,
}));

import { MemoryPane } from './MemoryPane.js';

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('<MemoryPane>', () => {
  let container: HTMLDivElement;
  let root: Root;
  let openFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    openFile = vi.fn();

    memoryPaneTestMocks.listMemoryMarkdownFiles.mockReset();
    memoryPaneTestMocks.subscribeMemoryPathChanged.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders friendly empty state when no memory exists yet', async () => {
    memoryPaneTestMocks.listMemoryMarkdownFiles.mockResolvedValue([]);

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

    expect(container.textContent).toContain('Memory files');
    expect(container.textContent).toContain('No memory yet');
    expect(container.textContent).toContain('handwritten notes');
  });

  it('opens markdown files in FilePane and refreshes on memory path change', async () => {
    memoryPaneTestMocks.listMemoryMarkdownFiles
      .mockResolvedValueOnce([
        {
          absolutePath: '/memory/local-user/profile.md',
          relativePath: 'profile.md',
          name: 'profile.md',
          modifiedAt: '2026-04-22T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          absolutePath: '/memory/local-user/sessions/2026-04-22-1000-session.md',
          relativePath: 'sessions/2026-04-22-1000-session.md',
          name: '2026-04-22-1000-session.md',
          modifiedAt: '2026-04-22T11:00:00.000Z',
        },
      ]);

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

    const firstButton = container.querySelector('button');
    if (!(firstButton instanceof HTMLButtonElement)) {
      throw new Error('Expected memory file button to render.');
    }

    await act(async () => {
      firstButton.click();
      await Promise.resolve();
    });

    expect(openFile).toHaveBeenCalledWith('/memory/local-user/profile.md', {
      mime: 'text/markdown',
    });

    await act(async () => {
      memoryPaneTestMocks.emitPathChanged();
      await Promise.resolve();
    });
    await flushEffects();

    expect(memoryPaneTestMocks.listMemoryMarkdownFiles).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('2026-04-22-1000-session.md');
  });
});
