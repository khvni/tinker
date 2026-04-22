import { describe, expect, it } from 'vitest';
import {
  COMPOSER_MAX_ROWS,
  calculateComposerHeight,
  shouldAbortComposerKey,
  shouldSubmitComposerKey,
} from './chat-composer.js';

describe('chat-composer helpers', () => {
  it('caps composer height at ten rows and enables internal scrolling beyond that', () => {
    const result = calculateComposerHeight({
      scrollHeight: 320,
      lineHeight: 20,
      paddingTop: 12,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
    });

    expect(result.maxHeight).toBe(COMPOSER_MAX_ROWS * 20 + 26);
    expect(result.height).toBe(result.maxHeight);
    expect(result.overflowY).toBe('auto');
  });

  it('keeps composer fully expanded when content stays under cap', () => {
    const result = calculateComposerHeight({
      scrollHeight: 120,
      lineHeight: 20,
      paddingTop: 12,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
    });

    expect(result.height).toBe(120);
    expect(result.overflowY).toBe('hidden');
  });

  it('submits on bare Enter only', () => {
    expect(
      shouldSubmitComposerKey({
        key: 'Enter',
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        isComposing: false,
      }),
    ).toBe(true);

    expect(
      shouldSubmitComposerKey({
        key: 'Enter',
        shiftKey: true,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        isComposing: false,
      }),
    ).toBe(false);

    expect(
      shouldSubmitComposerKey({
        key: 'Enter',
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        isComposing: true,
      }),
    ).toBe(false);
  });

  it('aborts only on Escape while streaming', () => {
    expect(shouldAbortComposerKey({ key: 'Escape', isStreaming: true })).toBe(true);
    expect(shouldAbortComposerKey({ key: 'Escape', isStreaming: false })).toBe(false);
    expect(shouldAbortComposerKey({ key: 'Enter', isStreaming: true })).toBe(false);
  });
});
