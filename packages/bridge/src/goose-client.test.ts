import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GooseClient } from './goose-client.js';
import type { TinkerStreamEvent } from './stream.js';

/**
 * Tests for the Goose ACP client's event parsing.
 * We mock `fetch` to return controlled SSE streams so we can verify
 * that ACP notifications get normalized to TinkerStreamEvents correctly.
 */

const createSSEResponse = (events: string[]): Response => {
  const body = events.map((e) => `data: ${e}\n\n`).join('');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
};

const notification = (
  sessionUpdate: string,
  payload: Record<string, unknown>,
): string =>
  JSON.stringify({
    jsonrpc: '2.0',
    method: 'session/notification',
    params: {
      sessionId: 'test-session',
      update: { sessionUpdate, ...payload },
    },
  });

const collectEvents = async (
  gen: AsyncGenerator<TinkerStreamEvent>,
): Promise<TinkerStreamEvent[]> => {
  const events: TinkerStreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
};

describe('GooseClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses agentMessageChunk into token events', async () => {
    const sseEvents = [
      notification('agentMessageChunk', {
        chunk: { content: { type: 'text', text: 'Hello ' } },
      }),
      notification('agentMessageChunk', {
        chunk: { content: { type: 'text', text: 'world!' } },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(client.prompt('test-session', 'Hi'));

    const tokens = events.filter((e) => e.type === 'token');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.type === 'token' && tokens[0]!.text).toBe('Hello ');
    expect(tokens[1]!.type === 'token' && tokens[1]!.text).toBe('world!');
    expect(events[events.length - 1]!.type).toBe('done');
  });

  it('parses agentThoughtChunk into reasoning events', async () => {
    const sseEvents = [
      notification('agentThoughtChunk', {
        chunk: { content: { type: 'text', text: 'Let me think...' } },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(client.prompt('test-session', 'Hi'));

    const reasoning = events.filter((e) => e.type === 'reasoning');
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0]!.type === 'reasoning' && reasoning[0]!.text).toBe(
      'Let me think...',
    );
  });

  it('parses toolCall into tool_call events', async () => {
    const sseEvents = [
      notification('toolCall', {
        toolCall: { id: 'call-1', title: 'Developer: List Files', status: 'pending' },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(client.prompt('test-session', 'ls'));

    const toolCalls = events.filter((e) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.type === 'tool_call' && toolCalls[0]!.name).toBe(
      'Developer: List Files',
    );
  });

  it('parses toolCallUpdate with completed status into tool_result', async () => {
    const sseEvents = [
      notification('toolCall', {
        toolCall: { id: 'call-2', title: 'Developer: Read', status: 'pending' },
      }),
      notification('toolCallUpdate', {
        toolCallUpdate: {
          id: 'call-2',
          fields: {
            status: 'completed',
            title: 'Developer: Read',
            content: [{ type: 'text', text: 'file content here' }],
          },
        },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(client.prompt('test-session', 'read'));

    const results = events.filter((e) => e.type === 'tool_result');
    expect(results).toHaveLength(1);
    expect(results[0]!.type === 'tool_result' && results[0]!.output).toBe(
      'file content here',
    );
  });

  it('detects delegated-agent tool calls and emits delegated_agent events', async () => {
    const sseEvents = [
      notification('toolCall', {
        toolCall: {
          id: 'deleg-1',
          title: 'Claude Code: refactor utils.ts',
          status: 'pending',
        },
      }),
      notification('toolCallUpdate', {
        toolCallUpdate: {
          id: 'deleg-1',
          fields: {
            status: 'completed',
            content: [{ type: 'text', text: 'Refactored 3 functions.' }],
          },
        },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(
      client.prompt('test-session', 'refactor utils'),
    );

    const delegations = events.filter((e) => e.type === 'delegated_agent');
    expect(delegations).toHaveLength(2);

    // First event: pending delegation
    const first = delegations[0]!;
    expect(first.type === 'delegated_agent' && first.agent).toBe('claude-code');
    expect(first.type === 'delegated_agent' && first.status).toBe('pending');

    // Second event: completed delegation
    const second = delegations[1]!;
    expect(second.type === 'delegated_agent' && second.agent).toBe(
      'claude-code',
    );
    expect(second.type === 'delegated_agent' && second.status).toBe(
      'completed',
    );
    expect(
      second.type === 'delegated_agent' &&
        second.content[0]?.text,
    ).toBe('Refactored 3 functions.');
  });

  it('emits errored status for failed delegated-agent tool calls', async () => {
    const sseEvents = [
      notification('toolCall', {
        toolCall: {
          id: 'deleg-err',
          title: 'Codex: fix bug',
          status: 'pending',
        },
      }),
      notification('toolCallUpdate', {
        toolCallUpdate: {
          id: 'deleg-err',
          fields: {
            status: 'error',
            content: [{ type: 'text', text: 'Connection timeout' }],
          },
        },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(
      client.prompt('test-session', 'fix bug'),
    );

    const delegations = events.filter((e) => e.type === 'delegated_agent');
    const errored = delegations.find(
      (e) => e.type === 'delegated_agent' && e.status === 'errored',
    );
    expect(errored).toBeDefined();
    expect(
      errored?.type === 'delegated_agent' && errored.content[0]?.text,
    ).toBe('Connection timeout');
  });

  it('emits error event when HTTP response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    );

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(
      client.prompt('test-session', 'crash'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('error');
  });

  it('normal tool calls are not treated as delegations', async () => {
    const sseEvents = [
      notification('toolCall', {
        toolCall: {
          id: 'tool-normal',
          title: 'Developer: List Files',
          status: 'pending',
        },
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents));

    const client = new GooseClient({ baseUrl: 'http://localhost:3284/acp' });
    const events = await collectEvents(
      client.prompt('test-session', 'ls'),
    );

    const delegations = events.filter((e) => e.type === 'delegated_agent');
    expect(delegations).toHaveLength(0);

    const toolCalls = events.filter((e) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
  });
});
