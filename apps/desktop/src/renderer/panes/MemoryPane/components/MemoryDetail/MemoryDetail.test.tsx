// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryMarkdownFile } from '@tinker/memory';

const { mockReadTextFile, mockWriteTextFile, mockRenderMarkdown } = vi.hoisted(() => ({
  mockReadTextFile: vi.fn<(path: string) => Promise<string>>(),
  mockWriteTextFile: vi.fn<(path: string, contents: string) => Promise<void>>(),
  mockRenderMarkdown: vi.fn<(text: string) => Promise<string>>(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: mockReadTextFile,
  writeTextFile: mockWriteTextFile,
}));

vi.mock('../../../../renderers/MarkdownRenderer.js', () => ({
  renderMarkdown: mockRenderMarkdown,
}));

import { MemoryDetail } from './MemoryDetail.js';

const makeFile = (overrides: Partial<MemoryMarkdownFile> = {}): MemoryMarkdownFile => ({
  absolutePath: '/memory/u/Pending/alice.md',
  relativePath: 'Pending/alice.md',
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

describe('<MemoryDetail>', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockReadTextFile.mockReset();
    mockWriteTextFile.mockReset();
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
          bucket="Pending"
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
          file={makeFile({ absolutePath: '/memory/u/Active Work/ship.md', relativePath: 'Active Work/ship.md', name: 'ship.md' })}
          bucket="Active Work"
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
          bucket="Pending"
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
          bucket="Pending"
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

  it('switches into edit mode, saves inline, and returns to read mode without any tab action', async () => {
    const onSaved = vi.fn();

    await act(async () => {
      root.render(
        <MemoryDetail
          file={makeFile()}
          bucket="Pending"
          diffText=""
          diffLoading={false}
          onApprove={() => undefined}
          onDismiss={() => undefined}
          onSaved={onSaved}
          isBusy={false}
        />,
      );
    });
    await flushEffects();

    const editButton = container.querySelector('button[aria-label="Edit"]');
    if (!(editButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Edit button.');
    }
    expect(container.querySelector('button[aria-label="Open as tab"]')).toBeNull();

    await act(async () => {
      editButton.click();
    });
    await flushEffects();

    const textarea = container.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected inline editor.');
    }

    await updateTextareaValue(textarea, '# Updated draft');
    await flushEffects();

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save',
    );
    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Save button.');
    }

    mockRenderMarkdown.mockResolvedValueOnce('<h1>Updated draft</h1>');

    await act(async () => {
      saveButton.click();
    });
    await flushEffects();

    expect(mockWriteTextFile).toHaveBeenCalledWith('/memory/u/Pending/alice.md', '# Updated draft');
    expect(onSaved).toHaveBeenCalledWith('/memory/u/Pending/alice.md');
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('Read mode');
    expect(container.textContent).toContain('Updated draft');
  });

  it('cancels inline edits and restores the saved markdown preview', async () => {
    await act(async () => {
      root.render(
        <MemoryDetail
          file={makeFile()}
          bucket="Pending"
          diffText=""
          diffLoading={false}
          onApprove={() => undefined}
          onDismiss={() => undefined}
          isBusy={false}
        />,
      );
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

    await updateTextareaValue(textarea, '# Unsaved draft');
    await flushEffects();

    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    );
    if (!(cancelButton instanceof HTMLButtonElement)) {
      throw new Error('Expected Cancel button.');
    }

    await act(async () => {
      cancelButton.click();
    });
    await flushEffects();

    expect(mockWriteTextFile).not.toHaveBeenCalled();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('Read mode');
    expect(container.textContent).toContain('Alice');
  });
});
