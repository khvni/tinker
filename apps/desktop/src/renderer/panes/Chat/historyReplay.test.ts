import { describe, expect, it } from 'vitest';
import type { RunEvent, StoredRunEvent } from '@tinker/shared-types';
import { replayRunEvents } from './historyReplay.js';

const makeEntry = (event: RunEvent): StoredRunEvent => ({
  ts: '2026-04-22T07:00:00.000Z',
  event,
});

describe('replayRunEvents', () => {
  it('rebuilds assistant messages from stored run events', () => {
    const entries: StoredRunEvent[] = [
      makeEntry({ type: 'token', partID: 'p-text', text: 'Loaded' }),
      makeEntry({ type: 'token', partID: 'p-text', text: ' prior chat.' }),
      makeEntry({ type: 'reasoning', partID: 'p-reason', text: 'Checking JSONL log.' }),
      makeEntry({
        type: 'tool_call',
        partID: 'p-tool',
        name: 'read',
        input: { path: '.tinker/chats/user-1/session-1.jsonl' },
      }),
      makeEntry({
        type: 'tool_result',
        partID: 'p-tool',
        name: 'read',
        output: 'contents',
      }),
      makeEntry({ type: 'done' }),
    ];

    expect(replayRunEvents(entries)).toEqual([
      {
        id: 'assistant-replay',
        role: 'assistant',
        blocks: [
          { kind: 'text', partID: 'p-text', text: 'Loaded prior chat.' },
          { kind: 'reasoning', partID: 'p-reason', text: 'Checking JSONL log.' },
          {
            kind: 'tool',
            partID: 'p-tool',
            name: 'read',
            input: { path: '.tinker/chats/user-1/session-1.jsonl' },
            state: 'completed',
            output: 'contents',
          },
        ],
      },
    ]);
  });

  it('handles tool errors', () => {
    const entries: StoredRunEvent[] = [
      makeEntry({
        type: 'tool_call',
        partID: 'p-tool',
        name: 'write',
        input: { path: '/tmp/test' },
      }),
      makeEntry({
        type: 'tool_error',
        partID: 'p-tool',
        name: 'write',
        message: 'permission denied',
      }),
      makeEntry({ type: 'done' }),
    ];

    expect(replayRunEvents(entries)).toEqual([
      {
        id: 'assistant-replay',
        role: 'assistant',
        blocks: [
          {
            kind: 'tool',
            partID: 'p-tool',
            name: 'write',
            input: { path: '/tmp/test' },
            state: 'error',
            error: 'permission denied',
          },
        ],
      },
    ]);
  });

  it('produces empty array for empty entries', () => {
    expect(replayRunEvents([])).toEqual([]);
  });
});
