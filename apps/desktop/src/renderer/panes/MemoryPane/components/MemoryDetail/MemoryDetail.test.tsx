// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryMarkdownFile } from '@tinker/memory';

const { mockReadTextFile, mockRenderMarkdown } = vi.hoisted(() => ({
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockRenderMarkdown: vi.fn<(text: string) => Promise<string>>(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: mockReadTextFile,
}));

vi.mock('../../../../renderers/MarkdownRenderer.js', () => ({
  renderMarkdown: mockRenderMarkdown,
}));

import { MemoryDetail } from './MemoryDetail.js';

const makeFile = (overrides: Partial<MemoryMarkdownFile> = {}): MemoryMarkdownFile => ({
  absolutePath: '/memory/u/pending/alice.md',
  relativePath: 'pending/alice.md',
  name: 'alice.md',
  modifiedAt: '2026-04-22T14:00:00.000Z',
  ...overrides,
});

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('<MemoryDetail>', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockReadTextFile.mockReset();
    mockRenderMarkdown.mockReset();
    mockReadTextFile.mockResolvedValue('# Alice');
    mockRenderMarkdown.mockResolvedValue('<h1>Alice</h1>');
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  it('renders the empty selection state when no file is passed', async () => {
    await act(async () => {
      root.render(
        <MemoryDetail
          file={null}
          bucket={null}
          diffText=""
          diffLoading={false}
          onApprove={() => undefined}
          onDismiss={() => undefined}
          isBusy={false}
        />,
      );
    });

    expect(container.textContent).toContain('Select a memory entry');
  });

  it('shows approve + dismiss actions for pending entries and fires callbacks', async () => {
    const onApprove = vi.fn();
    const onDismiss = vi.fn();

    await act(async () => {
      root.render(
        <MemoryDetail
          file={makeFile()}
          bucket="pending"
          diffText=""
          diffLoading={false}
          onApprove={onApprove}
          onDismiss={onDismiss}
          isBusy={false}
        />,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain('Update · Pending review');

    const approve = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.trim() === 'Approve',
    );
    const dismiss = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.trim() === 'Dismiss',
    );

    if (!(approve instanceof HTMLButtonElement) || !(dismiss instanceof HTMLButtonElement)) {
      throw new Error('Expected Approve + Dismiss buttons to render.');
    }

    await act(async () => {
      approve.click();
      dismiss.click();
    });

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('omits action buttons for non-pending buckets and shows the category badge', async () => {
    await act(async () => {
      root.render(
        <MemoryDetail
          file={makeFile({ absolutePath: '/memory/u/active-work/ship.md', relativePath: 'active-work/ship.md', name: 'ship.md' })}
          bucket="active-work"
          diffText=""
          diffLoading={false}
          onApprove={() => undefined}
          onDismiss={() => undefined}
          isBusy={false}
        />,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain('Active Work');
    const buttons = Array.from(container.querySelectorAll('button'))
      .map((button) => button.textContent?.trim());
    expect(buttons).not.toContain('Approve');
    expect(buttons).not.toContain('Dismiss');
  });

  it('renders diff text when present and empty-state copy when absent', async () => {
    await act(async () => {
      root.render(
        <MemoryDetail
          file={makeFile()}
          bucket="pending"
          diffText="+ new line\n- old line"
          diffLoading={false}
          onApprove={() => undefined}
          onDismiss={() => undefined}
          isBusy={false}
        />,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain('+ new line');

    await act(async () => {
      root.render(
        <MemoryDetail
          file={makeFile()}
          bucket="pending"
          diffText=""
          diffLoading={false}
          onApprove={() => undefined}
          onDismiss={() => undefined}
          isBusy={false}
        />,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain('No previous version on disk.');
  });
});
