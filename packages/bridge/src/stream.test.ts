import { describe, expect, it, vi } from 'vitest';
import type { Event, OpencodeClient, Part } from '@opencode-ai/sdk/v2/client';
import { streamSessionEvents, type TinkerStreamEvent } from './stream.js';

const toAsyncIterable = <T,>(values: T[]): AsyncIterable<T> => ({
  async *[Symbol.asyncIterator]() {
    yield* values;
  },
});

const makeClient = (events: Event[]): Pick<OpencodeClient, 'event'> => ({
  event: {
    subscribe: vi.fn().mockResolvedValue({
      stream: toAsyncIterable(events),
    }),
  },
}) as unknown as Pick<OpencodeClient, 'event'>;

const makeEvent = (type: Event['type'], properties: Record<string, unknown>): Event =>
  ({ type, properties } as Event);

const collectEvents = async (stream: AsyncIterable<TinkerStreamEvent>): Promise<TinkerStreamEvent[]> => {
  const events: TinkerStreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
};

describe('streamSessionEvents', () => {
  it('emits token + tool + file_written events with partID for the active session', async () => {
    const client = makeClient([
      makeEvent('message.part.delta', {
        sessionID: 'session-1',
        messageID: 'msg-1',
        partID: 'prt-text-1',
        field: 'text',
        delta: 'hello',
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-2',
        part: {
          type: 'patch',
          files: ['ignored.md'],
        },
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          id: 'prt-tool-1',
          sessionID: 'session-1',
          messageID: 'msg-1',
          type: 'tool',
          callID: 'call-1',
          tool: 'read',
          state: {
            status: 'running',
            input: { file: 'a.md' },
            time: { start: 0 },
          },
        } as Part,
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          id: 'prt-tool-1',
          sessionID: 'session-1',
          messageID: 'msg-1',
          type: 'tool',
          callID: 'call-1',
          tool: 'read',
          state: {
            status: 'completed',
            input: { file: 'a.md' },
            output: 'contents',
            title: 'a.md',
            metadata: {},
            time: { start: 0, end: 1 },
          },
        } as Part,
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          type: 'patch',
          files: ['a.md', 'b.md'],
        } as Part,
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          type: 'file',
          source: {
            type: 'file',
            path: 'c.md',
          },
        } as Part,
      }),
      makeEvent('session.idle', {
        sessionID: 'session-1',
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          type: 'patch',
          files: ['after-idle.md'],
        },
      }),
    ]);

    const events = await collectEvents(streamSessionEvents(client, 'session-1'));

    expect(events).toEqual([
      { type: 'token', partID: 'prt-text-1', text: 'hello' },
      { type: 'tool_call', partID: 'prt-tool-1', name: 'read', input: { file: 'a.md' } },
      { type: 'tool_result', partID: 'prt-tool-1', name: 'read', output: 'contents' },
      { type: 'file_written', path: 'a.md' },
      { type: 'file_written', path: 'b.md' },
      { type: 'file_written', path: 'c.md' },
      { type: 'done' },
    ]);
  });

  it('classifies subsequent text deltas as reasoning when the partID was registered as a ReasoningPart', async () => {
    const client = makeClient([
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          id: 'prt-reasoning-1',
          sessionID: 'session-1',
          messageID: 'msg-1',
          type: 'reasoning',
          text: '',
          time: { start: 0 },
        } as Part,
      }),
      makeEvent('message.part.delta', {
        sessionID: 'session-1',
        messageID: 'msg-1',
        partID: 'prt-reasoning-1',
        field: 'text',
        delta: 'thinking…',
      }),
      makeEvent('message.part.delta', {
        sessionID: 'session-1',
        messageID: 'msg-1',
        partID: 'prt-text-1',
        field: 'text',
        delta: 'Answer.',
      }),
      makeEvent('session.idle', {
        sessionID: 'session-1',
      }),
    ]);

    const events = await collectEvents(streamSessionEvents(client, 'session-1'));

    expect(events).toEqual([
      { type: 'reasoning', partID: 'prt-reasoning-1', text: 'thinking…' },
      { type: 'token', partID: 'prt-text-1', text: 'Answer.' },
      { type: 'done' },
    ]);
  });

  it('emits a tool_error event when a ToolPart finishes with status=error', async () => {
    const client = makeClient([
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          id: 'prt-tool-err',
          sessionID: 'session-1',
          messageID: 'msg-1',
          type: 'tool',
          callID: 'call-err',
          tool: 'bash',
          state: {
            status: 'error',
            input: { command: 'exit 1' },
            error: 'command failed',
            time: { start: 0, end: 1 },
          },
        } as Part,
      }),
      makeEvent('session.idle', {
        sessionID: 'session-1',
      }),
    ]);

    const events = await collectEvents(streamSessionEvents(client, 'session-1'));

    expect(events).toEqual([
      { type: 'tool_error', partID: 'prt-tool-err', name: 'bash', message: 'command failed' },
      { type: 'done' },
    ]);
  });

  it('emits error from session.error and stops', async () => {
    const client = makeClient([
      makeEvent('session.error', {
        sessionID: 'session-1',
        error: {
          name: 'OpenCodeError',
          data: {
            message: 'broken',
          },
        },
      }),
      makeEvent('message.part.updated', {
        sessionID: 'session-1',
        part: {
          type: 'patch',
          files: ['ignored.md'],
        },
      }),
    ]);

    const events = await collectEvents(streamSessionEvents(client, 'session-1'));

    expect(events).toEqual([{ type: 'error', message: 'broken' }]);
  });
});
