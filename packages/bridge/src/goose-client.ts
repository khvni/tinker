/**
 * Goose ACP client — speaks the Agent Client Protocol over HTTP/SSE
 * to a running Goose server.
 *
 * Tinker uses this as its primary chat runtime. The client handles:
 * - Connection lifecycle (`initialize`)
 * - Session management (`session/new`, `session/load`)
 * - Streaming prompt/response (`session/prompt`, `session/cancel`)
 * - Parsing Goose notifications into `TinkerStreamEvent`
 *
 * The HTTP transport follows the Streamable HTTP spec from
 * `aaif-goose/goose` PR #6741: all requests go to `POST /acp`
 * and streaming responses come back as SSE on the same connection.
 */

import type { TinkerStreamEvent } from './stream.js';

// ---------------------------------------------------------------------------
// JSON-RPC primitives
// ---------------------------------------------------------------------------

type JsonRpcRequest = {
  jsonrpc: '2.0';
  method: string;
  id: number;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// ACP-specific message shapes
// ---------------------------------------------------------------------------

type AcpSessionNewResult = {
  sessionId: string;
  models?: {
    current?: string;
    available?: ReadonlyArray<{ id: string; name: string }>;
  };
};

type AcpInitializeResult = {
  protocolVersion: string;
  agentCapabilities?: Record<string, unknown>;
};

/** An SSE notification from Goose during a `session/prompt`. */
type AcpSessionUpdate =
  | {
      sessionUpdate: 'agentMessageChunk';
      chunk: { content: { type: string; text: string } };
    }
  | {
      sessionUpdate: 'agentThoughtChunk';
      chunk: { content: { type: string; text: string } };
    }
  | {
      sessionUpdate: 'toolCall';
      toolCall: {
        id: string;
        title: string;
        status: string;
      };
    }
  | {
      sessionUpdate: 'toolCallUpdate';
      toolCallUpdate: {
        id: string;
        fields: {
          status?: string;
          title?: string;
          content?: ReadonlyArray<{ type: string; text: string }>;
          locations?: ReadonlyArray<{ path: string; line?: number }>;
        };
      };
    };

type AcpNotificationParams = {
  sessionId: string;
  update: AcpSessionUpdate;
};

// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

export type GooseClientConfig = {
  /** ACP HTTP endpoint, e.g. `http://127.0.0.1:3284/acp`. */
  baseUrl: string;
  /** Client identity sent during `initialize`. */
  clientName?: string;
  clientVersion?: string;
};

// ---------------------------------------------------------------------------
// GooseClient
// ---------------------------------------------------------------------------

export class GooseClient {
  private readonly baseUrl: string;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private requestId = 0;
  private acpSessionId: string | null = null;

  constructor(config: GooseClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/u, '');
    this.clientName = config.clientName ?? 'tinker';
    this.clientVersion = config.clientVersion ?? '0.1.0';
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<AcpInitializeResult> {
    const result = await this.rpc<AcpInitializeResult>('initialize', {
      protocolVersion: 'v1',
      clientInfo: { name: this.clientName, version: this.clientVersion },
    });
    return result;
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  async sessionNew(cwd: string): Promise<AcpSessionNewResult> {
    const result = await this.rpc<AcpSessionNewResult>('session/new', { cwd });
    this.acpSessionId = result.sessionId;
    return result;
  }

  async sessionLoad(sessionId: string, cwd: string): Promise<void> {
    await this.rpc('session/load', { sessionId, cwd });
    this.acpSessionId = sessionId;
  }

  // -------------------------------------------------------------------------
  // Prompt + streaming
  // -------------------------------------------------------------------------

  /**
   * Send a prompt and yield `TinkerStreamEvent`s as Goose streams
   * back notifications. The generator completes when the final
   * `session/prompt` response arrives.
   */
  async *prompt(
    sessionId: string,
    text: string,
  ): AsyncGenerator<TinkerStreamEvent> {
    const id = ++this.requestId;
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'session/prompt',
      id,
      params: {
        sessionId,
        prompt: [{ type: 'text', text }],
      },
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(this.acpSessionId
          ? { 'Acp-Session-Id': this.acpSessionId }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      yield {
        type: 'error',
        message: `Goose ACP request failed: ${String(response.status)} ${response.statusText}`,
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', message: 'Goose ACP response has no body.' };
      return;
    }

    // Track delegated-agent tool calls to detect ACP provider delegations
    const delegationCalls = new Map<
      string,
      { agent: string; title: string }
    >();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep incomplete last line in buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data.length === 0 || data === '[DONE]') continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          const events = this.parseAcpMessage(
            parsed as JsonRpcNotification | JsonRpcResponse,
            delegationCalls,
          );
          for (const event of events) {
            yield event;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  /** Cancel an in-progress prompt. Fire-and-forget (notification). */
  async cancel(sessionId: string): Promise<void> {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'session/cancel',
      params: { sessionId },
    };
    await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.acpSessionId
          ? { 'Acp-Session-Id': this.acpSessionId }
          : {}),
      },
      body: JSON.stringify(notification),
    }).catch(() => {
      // Best-effort cancel — swallow network errors.
    });
  }

  getSessionId(): string | null {
    return this.acpSessionId;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async rpc<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const id = ++this.requestId;
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      id,
      ...(params !== undefined ? { params } : {}),
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.acpSessionId
          ? { 'Acp-Session-Id': this.acpSessionId }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Goose ACP RPC "${method}" failed: ${String(response.status)} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(
        `Goose ACP RPC "${method}" error ${String(json.error.code)}: ${json.error.message}`,
      );
    }

    return json.result as T;
  }

  /**
   * ACP coding-agent providers (claude-code, codex, opencode) surface as
   * tool-calls whose title starts with the provider label. When Goose
   * delegates to one of these, we emit a `delegated_agent` event so the
   * Chat UI can render a collapsed disclosure.
   */
  private static readonly DELEGATION_PREFIXES = [
    'Claude Code:',
    'Codex:',
    'OpenCode:',
  ] as const;

  private static isDelegationToolCall(title: string): {
    agent: string;
    label: string;
  } | null {
    for (const prefix of GooseClient.DELEGATION_PREFIXES) {
      if (title.startsWith(prefix)) {
        return {
          agent: prefix.slice(0, -1).toLowerCase().replace(/\s+/gu, '-'),
          label: title.slice(prefix.length).trim(),
        };
      }
    }
    return null;
  }

  /** Parse a single SSE message into zero or more `TinkerStreamEvent`s. */
  private parseAcpMessage(
    msg: JsonRpcNotification | JsonRpcResponse,
    delegationCalls: Map<string, { agent: string; title: string }>,
  ): TinkerStreamEvent[] {
    // Final response for the prompt — not a notification.
    if ('id' in msg && msg.id !== undefined) {
      if (msg.error) {
        return [
          {
            type: 'error',
            message: `Goose error: ${msg.error.message}`,
          },
        ];
      }
      return [];
    }

    const notification = msg as JsonRpcNotification;
    if (notification.method !== 'session/notification') {
      return [];
    }

    const params = notification.params as AcpNotificationParams | undefined;
    if (!params?.update) {
      return [];
    }

    const { update } = params;

    switch (update.sessionUpdate) {
      case 'agentMessageChunk': {
        const text = update.chunk.content.text;
        return [{ type: 'token', partID: 'goose-msg', text }];
      }

      case 'agentThoughtChunk': {
        const text = update.chunk.content.text;
        return [{ type: 'reasoning', partID: 'goose-thought', text }];
      }

      case 'toolCall': {
        const { id: callId, title, status } = update.toolCall;

        // Check if this tool-call is a delegation to an ACP coding agent.
        const delegation = GooseClient.isDelegationToolCall(title);
        if (delegation) {
          delegationCalls.set(callId, {
            agent: delegation.agent,
            title: delegation.label || title,
          });
          return [
            {
              type: 'delegated_agent',
              id: callId,
              agent: delegation.agent,
              title: delegation.label || title,
              status: status === 'completed' ? 'completed' : 'pending',
              content: [],
            },
          ];
        }

        return [
          {
            type: 'tool_call',
            partID: callId,
            name: title,
            input: {},
          },
        ];
      }

      case 'toolCallUpdate': {
        const { id: callId, fields } = update.toolCallUpdate;
        const existing = delegationCalls.get(callId);

        if (existing) {
          const status = fields.status === 'completed'
            ? 'completed' as const
            : fields.status === 'error'
              ? 'errored' as const
              : 'running' as const;

          const content = (fields.content ?? []).map((c) => ({
            type: c.type,
            text: c.text,
          }));

          return [
            {
              type: 'delegated_agent',
              id: callId,
              agent: existing.agent,
              title: fields.title ?? existing.title,
              status,
              content,
            },
          ];
        }

        // Regular tool-call update
        if (fields.status === 'completed') {
          const output = (fields.content ?? [])
            .map((c) => c.text)
            .join('\n');
          return [
            {
              type: 'tool_result',
              partID: callId,
              name: fields.title ?? callId,
              output,
            },
          ];
        }

        if (fields.status === 'error') {
          const message = (fields.content ?? [])
            .map((c) => c.text)
            .join('\n');
          return [
            {
              type: 'tool_error',
              partID: callId,
              name: fields.title ?? callId,
              message: message || 'Tool call failed.',
            },
          ];
        }

        // File-write locations
        const fileEvents: TinkerStreamEvent[] = [];
        for (const loc of fields.locations ?? []) {
          fileEvents.push({ type: 'file_written', path: loc.path });
        }
        return fileEvents;
      }

      default:
        return [];
    }
  }
}
