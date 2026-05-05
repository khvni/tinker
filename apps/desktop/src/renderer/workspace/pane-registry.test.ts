import { afterEach, describe, expect, it } from 'vitest';
import type { TinkerPaneData } from '@tinker/shared-types';
import { getRenderer, registerPane, resetPaneRegistry } from './pane-registry.js';

describe('pane registry', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('returns the renderer registered for a given kind', () => {
    const render = (data: Extract<TinkerPaneData, { kind: 'chat' }>) => `rendered:${data.kind}`;
    registerPane('chat', render);

    const resolved = getRenderer('chat');
    expect(resolved({ kind: 'chat' })).toBe('rendered:chat');
  });

  it('narrows the data payload passed to each renderer by kind', () => {
    registerPane('file', (data) => `${data.path}|${data.mime}`);

    const render = getRenderer('file');
    expect(render({ kind: 'file', path: '/tmp/a.md', mime: 'text/markdown' })).toBe(
      '/tmp/a.md|text/markdown',
    );
  });

  it('supports every split-tree pane kind', () => {
    registerPane('chat', () => 'c');
    registerPane('file', () => 'f');

    expect(getRenderer('chat')({ kind: 'chat' })).toBe('c');
    expect(
      getRenderer('file')({ kind: 'file', path: '/a', mime: 'text/plain' }),
    ).toBe('f');
  });

  it('throws a descriptive error when the kind has no renderer', () => {
    expect(() => getRenderer('chat')).toThrowError(
      /no renderer registered for pane kind "chat".*Registered kinds: <none>/,
    );

    registerPane('file', () => null);
    expect(() => getRenderer('chat')).toThrowError(
      /no renderer registered for pane kind "chat".*Registered kinds: file/,
    );
  });

  it('throws when the same kind is registered twice', () => {
    registerPane('chat', () => 'first');
    expect(() => registerPane('chat', () => 'second')).toThrowError(
      /renderer for kind "chat" is already registered/,
    );
  });

  it('resetPaneRegistry allows re-registration', () => {
    registerPane('chat', () => 'first');
    resetPaneRegistry();
    registerPane('chat', () => 'second');

    expect(getRenderer('chat')({ kind: 'chat' })).toBe('second');
  });
});
