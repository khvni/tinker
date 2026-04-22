import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_HISTORY_WINDOW_SIZE,
  getInitialSessionHistoryStart,
  getNextSessionHistoryStartAfterOlderLoad,
  getNextSessionHistoryStartForAppend,
  getNextSessionHistoryStartForReveal,
  getPreservedScrollTop,
} from './useSessionHistoryWindow.js';

describe('useSessionHistoryWindow helpers', () => {
  it('defaults to a 100-message window', () => {
    expect(DEFAULT_SESSION_HISTORY_WINDOW_SIZE).toBe(100);
    expect(getInitialSessionHistoryStart(80, DEFAULT_SESSION_HISTORY_WINDOW_SIZE)).toBe(0);
    expect(getInitialSessionHistoryStart(140, DEFAULT_SESSION_HISTORY_WINDOW_SIZE)).toBe(40);
  });

  it('reveals cached history in bounded batches', () => {
    expect(getNextSessionHistoryStartForReveal(60, 25)).toBe(35);
    expect(getNextSessionHistoryStartForReveal(10, 25)).toBe(0);
  });

  it('keeps the trailing window bounded when new messages append at the bottom', () => {
    expect(
      getNextSessionHistoryStartForAppend({
        currentStart: 0,
        previousTotal: 100,
        nextTotal: 140,
        windowSize: 100,
      }),
    ).toBe(40);
  });

  it('preserves revealed history when new messages append', () => {
    expect(
      getNextSessionHistoryStartForAppend({
        currentStart: 12,
        previousTotal: 140,
        nextTotal: 150,
        windowSize: 100,
      }),
    ).toBe(12);
  });

  it('reveals older loaded history in one batch when already at the top', () => {
    expect(
      getNextSessionHistoryStartAfterOlderLoad({
        previousStart: 0,
        previousTotal: 100,
        nextTotal: 140,
        previousRendered: 100,
        revealBatch: 25,
      }),
    ).toBe(15);
  });

  it('preserves the current viewport when older history loads behind a partial window', () => {
    expect(
      getNextSessionHistoryStartAfterOlderLoad({
        previousStart: 20,
        previousTotal: 140,
        nextTotal: 180,
        previousRendered: 120,
        revealBatch: 25,
      }),
    ).toBe(60);
  });

  it('restores scroll position by the added height delta', () => {
    expect(
      getPreservedScrollTop({
        beforeTop: 320,
        beforeHeight: 1200,
        afterHeight: 1500,
      }),
    ).toBe(620);
  });
});
