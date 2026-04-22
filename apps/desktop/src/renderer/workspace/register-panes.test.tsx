import { afterEach, describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { resetPaneRegistry, getRenderer } from './pane-registry.js';
import { registerWorkspacePanes } from './register-panes.js';
import { FilePane } from '../panes/FilePane/index.js';
import { RegisteredChatPane } from './components/RegisteredChatPane/index.js';

describe('registerWorkspacePanes', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('bootstraps the chat and file pane renderers', () => {
    registerWorkspacePanes();

    const chatPane = getRenderer('chat')({ kind: 'chat' });
    expect(isValidElement(chatPane)).toBe(true);

    if (!isValidElement(chatPane)) {
      throw new Error('chat renderer should return a React element');
    }

    expect(chatPane.type).toBe(RegisteredChatPane);

    const filePane = getRenderer('file')({
      kind: 'file',
      path: '/tmp/note.md',
      mime: 'text/markdown',
    });
    expect(isValidElement(filePane)).toBe(true);

    if (!isValidElement(filePane)) {
      throw new Error('file renderer should return a React element');
    }

    expect(filePane.type).toBe(FilePane);
  });

  it('is safe to call more than once', () => {
    registerWorkspacePanes();
    expect(() => registerWorkspacePanes()).not.toThrow();
  });
});
