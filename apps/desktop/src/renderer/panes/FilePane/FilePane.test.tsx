import { open as openExternal } from '@tauri-apps/plugin-shell';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRenderer, resetPaneRegistry } from '../../workspace/pane-registry.js';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

import {
  FilePane,
  MARKDOWN_EDITOR_MIME,
  MISSING_FILE_MIME,
  mimeToRenderer,
  openFileExternally,
  registerFilePane,
} from './index.js';

describe('FilePane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetPaneRegistry();
  });

  it('registers file pane kind with the dispatch component', () => {
    registerFilePane({ vaultRevision: 7 });

    const element = getRenderer('file')({
      kind: 'file',
      path: '/tmp/note.md',
      mime: 'text/markdown',
    });

    expect(isValidElement(element)).toBe(true);
    if (!isValidElement(element)) {
      throw new Error('registerFilePane did not return a React element.');
    }

    expect(element.type).toBe(FilePane);
    expect(element.props).toMatchObject({
      data: {
        kind: 'file',
        path: '/tmp/note.md',
        mime: 'text/markdown',
      },
      vaultRevision: 7,
    });
  });

  it('dispatches known MIME types through mimeToRenderer', () => {
    const markup = renderToStaticMarkup(
      <FilePane
        data={{
          kind: 'file',
          path: '/tmp/table.csv',
          mime: 'text/csv',
        }}
      />,
    );

    expect(markup).toContain('tinker-renderer-pane');
  });

  it('includes a lazy PDF renderer in the MIME dispatch map', () => {
    expect(mimeToRenderer['application/pdf']).toBeDefined();
  });

  it('supports the temporary markdown editor MIME until the editor flow is replaced', () => {
    expect(mimeToRenderer[MARKDOWN_EDITOR_MIME]).toBeDefined();
  });

  it('dispatches DOCX files through the DOCX renderer', () => {
    expect(
      mimeToRenderer['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ).toBeDefined();
  });

  it('routes pptx files through the explicit external-preview fallback', () => {
    const markup = renderToStaticMarkup(
      <FilePane
        data={{
          kind: 'file',
          path: '/tmp/deck.pptx',
          mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }}
      />,
    );

    expect(markup).toContain('PPTX preview');
    expect(markup).toContain('Inline PowerPoint preview is unavailable.');
    expect(markup).toContain('Open externally');
  });

  it('opens unsupported files through the OS shell helper', async () => {
    await openFileExternally('/tmp/archive.bin');

    expect(openExternal).toHaveBeenCalledWith('/tmp/archive.bin');
  });

  it('renders unsupported fallback UI for unknown MIME types', () => {
    const markup = renderToStaticMarkup(
      <FilePane
        data={{
          kind: 'file',
          path: '/tmp/archive.bin',
          mime: 'application/octet-stream',
        }}
      />,
    );

    expect(markup).toContain('Unsupported file');
    expect(markup).toContain('Unsupported, open externally.');
    expect(markup).toContain('Open externally');
    expect(markup).toContain('application/octet-stream');
  });

  it('renders a friendly missing-file state', () => {
    const markup = renderToStaticMarkup(
      <FilePane
        data={{
          kind: 'file',
          path: '/tmp/missing.md',
          mime: MISSING_FILE_MIME,
        }}
      />,
    );

    expect(markup).toContain('File unavailable');
    expect(markup).toContain('File no longer exists at this path.');
    expect(markup).toContain('/tmp/missing.md');
  });
});
