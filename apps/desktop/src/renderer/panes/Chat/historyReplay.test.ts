import { describe, expect, it } from 'vitest';
import type { StoredChatEvent } from '@tinker/bridge';
import type { Part } from '@opencode-ai/sdk/v2/client';
import { replayChatHistory } from './historyReplay.js';

const makeEntry = (event: string, data: unknown): StoredChatEvent => ({
  ts: '2026-04-22T07:00:00.000Z',
  event,
  data,
});

describe('replayChatHistory', () => {
  it('rebuilds user and assistant messages from stored OpenCode events', () => {
    const entries: StoredChatEvent[] = [
      makeEntry('message.updated', {
        info: {
          id: 'msg-user',
          role: 'user',
          time: { created: 1 },
        },
      }),
      makeEntry('message.part.updated', {
        part: {
          id: 'part-user-text',
          sessionID: 'session-1',
          messageID: 'msg-user',
          type: 'text',
          text: 'Explain session history.',
        } as Part,
      }),
      makeEntry('message.updated', {
        info: {
          id: 'msg-assistant',
          role: 'assistant',
          time: { created: 2 },
        },
      }),
      makeEntry('message.part.updated', {
        part: {
          id: 'part-assistant-text',
          sessionID: 'session-1',
          messageID: 'msg-assistant',
          type: 'text',
          text: '',
        } as Part,
      }),
      makeEntry('message.part.delta', {
        messageID: 'msg-assistant',
        partID: 'part-assistant-text',
        field: 'text',
        delta: 'Loaded prior chat.',
      }),
      makeEntry('message.part.updated', {
        part: {
          id: 'part-reasoning',
          sessionID: 'session-1',
          messageID: 'msg-assistant',
          type: 'reasoning',
          text: '',
          time: { start: 0 },
        } as Part,
      }),
      makeEntry('message.part.delta', {
        messageID: 'msg-assistant',
        partID: 'part-reasoning',
        field: 'text',
        delta: 'Checking JSONL log.',
      }),
      makeEntry('message.part.updated', {
        part: {
          id: 'part-tool',
          sessionID: 'session-1',
          messageID: 'msg-assistant',
          type: 'tool',
          callID: 'call-1',
          tool: 'read',
          state: {
            status: 'completed',
            input: { path: '.tinker/chats/user-1/session-1.jsonl' },
            output: 'contents',
            title: 'session-1.jsonl',
            metadata: {},
            time: { start: 0, end: 1 },
          },
        } as Part,
      }),
    ];

    expect(replayChatHistory(entries)).toEqual([
      {
        id: 'msg-user',
        role: 'user',
        blocks: [{ kind: 'text', partID: 'part-user-text', text: 'Explain session history.' }],
      },
      {
        id: 'msg-assistant',
        role: 'assistant',
        blocks: [
          { kind: 'text', partID: 'part-assistant-text', text: 'Loaded prior chat.' },
          { kind: 'reasoning', partID: 'part-reasoning', text: 'Checking JSONL log.' },
          {
            kind: 'tool',
            partID: 'part-tool',
            name: 'read',
            input: { path: '.tinker/chats/user-1/session-1.jsonl' },
            state: 'completed',
            output: 'contents',
          },
        ],
      },
    ]);
  });

  it('removes deleted messages and parts during replay', () => {
    const entries: StoredChatEvent[] = [
      makeEntry('message.updated', {
        info: {
          id: 'msg-1',
          role: 'assistant',
          time: { created: 1 },
        },
      }),
      makeEntry('message.part.updated', {
        part: {
          id: 'part-1',
          sessionID: 'session-1',
          messageID: 'msg-1',
          type: 'text',
          text: 'temporary',
        } as Part,
      }),
      makeEntry('message.part.removed', {
        messageID: 'msg-1',
        partID: 'part-1',
      }),
      makeEntry('message.removed', {
        messageID: 'msg-1',
      }),
    ];

    expect(replayChatHistory(entries)).toEqual([]);
  });
});
