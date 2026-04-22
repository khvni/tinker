import { afterEach, describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { resetPaneRegistry, getRenderer } from './pane-registry.js';
import { registerWorkspacePanes } from './register-panes.js';
import { RegisteredChatPane } from './components/RegisteredChatPane/index.js';

describe('registerWorkspacePanes', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('bootstraps the chat pane renderer', () => {
    registerWorkspacePanes();

    const rendered = getRenderer('chat')({ kind: 'chat' });
    expect(isValidElement(rendered)).toBe(true);

    if (!isValidElement(rendered)) {
      throw new Error('chat renderer should return a React element');
    }

    expect(rendered.type).toBe(RegisteredChatPane);
  });

  it('is safe to call more than once', () => {
    registerWorkspacePanes();
    expect(() => registerWorkspacePanes()).not.toThrow();
  });
});
