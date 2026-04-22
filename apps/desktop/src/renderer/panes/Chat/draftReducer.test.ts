import { describe, expect, it } from 'vitest';
import { draftReducer } from './draftReducer.js';
import type { Block } from './Block.js';

describe('draftReducer', () => {
  it('appends a new text block when the partID is unseen', () => {
    const next = draftReducer([], { type: 'event', event: { type: 'token', partID: 'p1', text: 'hi' } });
    expect(next).toEqual<Block[]>([{ kind: 'text', partID: 'p1', text: 'hi' }]);
  });

  it('concatenates token deltas into the existing text block', () => {
    const after1 = draftReducer([], { type: 'event', event: { type: 'token', partID: 'p1', text: 'hel' } });
    const after2 = draftReducer(after1, { type: 'event', event: { type: 'token', partID: 'p1', text: 'lo' } });
    expect(after2).toEqual<Block[]>([{ kind: 'text', partID: 'p1', text: 'hello' }]);
  });

  it('concatenates reasoning deltas into the existing reasoning block', () => {
    const after1 = draftReducer([], { type: 'event', event: { type: 'reasoning', partID: 'r1', text: 'thi' } });
    const after2 = draftReducer(after1, { type: 'event', event: { type: 'reasoning', partID: 'r1', text: 'nking' } });
    expect(after2).toEqual<Block[]>([{ kind: 'reasoning', partID: 'r1', text: 'thinking' }]);
  });

  it('transitions a pending tool_call to a completed tool_result', () => {
    const after1 = draftReducer([], {
      type: 'event',
      event: { type: 'tool_call', partID: 't1', name: 'read', input: { path: 'a.md' } },
    });
    expect(after1).toEqual<Block[]>([
      { kind: 'tool', partID: 't1', name: 'read', input: { path: 'a.md' }, state: 'pending' },
    ]);

    const after2 = draftReducer(after1, {
      type: 'event',
      event: { type: 'tool_result', partID: 't1', name: 'read', output: 'contents' },
    });
    expect(after2).toEqual<Block[]>([
      { kind: 'tool', partID: 't1', name: 'read', input: { path: 'a.md' }, state: 'completed', output: 'contents' },
    ]);
  });

  it('transitions a pending tool_call to a tool_error', () => {
    const after1 = draftReducer([], {
      type: 'event',
      event: { type: 'tool_call', partID: 't2', name: 'bash', input: { cmd: 'exit 1' } },
    });
    const after2 = draftReducer(after1, {
      type: 'event',
      event: { type: 'tool_error', partID: 't2', name: 'bash', message: 'failed' },
    });
    expect(after2).toEqual<Block[]>([
      { kind: 'tool', partID: 't2', name: 'bash', input: { cmd: 'exit 1' }, state: 'error', error: 'failed' },
    ]);
  });

  it('drops a delta when its partID is held by a different block kind', () => {
    const initial: Block[] = [{ kind: 'text', partID: 'p1', text: 'hi' }];
    const next = draftReducer(initial, { type: 'event', event: { type: 'reasoning', partID: 'p1', text: 'oops' } });
    expect(next).toEqual(initial);
  });

  it('resets to an empty list', () => {
    const initial: Block[] = [{ kind: 'text', partID: 'p1', text: 'hi' }];
    expect(draftReducer(initial, { type: 'reset' })).toEqual([]);
  });

  it('synthesizes a tool block when tool_result arrives without a prior tool_call', () => {
    const next = draftReducer([], {
      type: 'event',
      event: { type: 'tool_result', partID: 't3', name: 'read', output: 'data' },
    });
    expect(next).toEqual<Block[]>([
      { kind: 'tool', partID: 't3', name: 'read', input: {}, state: 'completed', output: 'data' },
    ]);
  });
});
