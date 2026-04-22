// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryEntryBucket, MemoryMarkdownFile } from '@tinker/memory';
import { MemorySidebar } from './MemorySidebar.js';

const makeFile = (
  absolutePath: string,
  relativePath: string,
  modifiedAt: string,
): MemoryMarkdownFile => ({
  absolutePath,
  relativePath,
  name: relativePath.split('/').at(-1) ?? relativePath,
  title: relativePath.split('/').at(-1)?.replace(/\.md$/u, '') ?? relativePath,
  modifiedAt,
  category: null,
  displayPath: absolutePath,
  changesPreview: null,
});

const emptyBuckets = (): Record<MemoryEntryBucket, MemoryMarkdownFile[]> => ({
  Pending: [],
  People: [],
  'Active Work': [],
  Capabilities: [],
  Preferences: [],
  Organization: [],
});

describe('<MemorySidebar>', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  it('renders empty state when every bucket is empty', async () => {
    await act(async () => {
      root.render(
        <MemorySidebar
          buckets={emptyBuckets()}
          searchQuery=""
          onSearchChange={() => undefined}
          selectedPath={null}
          onSelect={() => undefined}
          seenPaths={new Set()}
        />,
      );
    });

    expect(container.textContent).toContain('No memory yet');
  });

  it('renders pending entries with unread dot until seen, and fires onSelect', async () => {
    const buckets = emptyBuckets();
    buckets.Pending = [
      makeFile('/memory/u/Pending/alice.md', 'Pending/alice.md', '2026-04-22T14:00:00.000Z'),
      makeFile('/memory/u/Pending/bob.md', 'Pending/bob.md', '2026-04-22T12:00:00.000Z'),
    ];
    buckets.People = [makeFile('/memory/u/People/khani.md', 'People/khani.md', '2026-04-21T08:00:00.000Z')];

    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <MemorySidebar
          buckets={buckets}
          searchQuery=""
          onSearchChange={() => undefined}
          selectedPath={null}
          onSelect={onSelect}
          seenPaths={new Set(['/memory/u/Pending/bob.md'])}
        />,
      );
    });

    expect(container.textContent).toContain('Pending');
    expect(container.textContent).toContain('alice');
    expect(container.textContent).toContain('bob');
    expect(container.textContent).toContain('People');
    expect(container.textContent).toContain('1');

    const dots = container.querySelectorAll('.tinker-memory-sidebar__row-dot');
    expect(dots.length).toBe(1);

    const aliceRow = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('alice'),
    );
    if (!(aliceRow instanceof HTMLButtonElement)) {
      throw new Error('Expected alice row to render as button.');
    }
    await act(async () => {
      aliceRow.click();
    });

    expect(onSelect).toHaveBeenCalledWith(buckets.Pending[0], 'Pending');
  });

  it('expands category sections on header click and selects the row', async () => {
    const buckets = emptyBuckets();
    buckets['Active Work'] = [
      makeFile('/memory/u/Active Work/ship.md', 'Active Work/ship.md', '2026-04-22T09:00:00.000Z'),
    ];

    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <MemorySidebar
          buckets={buckets}
          searchQuery=""
          onSearchChange={() => undefined}
          selectedPath={null}
          onSelect={onSelect}
          seenPaths={new Set()}
        />,
      );
    });

    const header = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Active Work'),
    );
    if (!(header instanceof HTMLButtonElement)) {
      throw new Error('Expected Active Work header button.');
    }

    expect(container.textContent).not.toContain('ship');

    await act(async () => {
      header.click();
    });

    expect(container.textContent).toContain('ship');

    const shipRow = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('ship'),
    );
    if (!(shipRow instanceof HTMLButtonElement)) {
      throw new Error('Expected ship row button.');
    }
    await act(async () => {
      shipRow.click();
    });

    expect(onSelect).toHaveBeenCalledWith(buckets['Active Work'][0], 'Active Work');
  });

  it('filters entries by search query (case-insensitive)', async () => {
    const buckets = emptyBuckets();
    buckets.Pending = [
      makeFile('/memory/u/Pending/alpha.md', 'Pending/alpha.md', '2026-04-22T10:00:00.000Z'),
      makeFile('/memory/u/Pending/zeta.md', 'Pending/zeta.md', '2026-04-22T09:00:00.000Z'),
    ];

    await act(async () => {
      root.render(
        <MemorySidebar
          buckets={buckets}
          searchQuery="ALPHA"
          onSearchChange={() => undefined}
          selectedPath={null}
          onSelect={() => undefined}
          seenPaths={new Set()}
        />,
      );
    });

    expect(container.textContent).toContain('alpha');
    expect(container.textContent).not.toContain('zeta');
  });
});
