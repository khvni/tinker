/**
 * AgentSideConnection — ACP stdio client.
 *
 * Implements the client side of the Agent Client Protocol over stdio.
 * Handles the full lifecycle:
 *   1. Spawn agent subprocess
 *   2. `initialize` handshake (negotiate protocol version + capabilities)
 *   3. `session/new` to create a session
 *   4. `session/prompt` with streaming notifications
 *   5. `session/cancel` for abort
 *   6. `session/request_permission` handling (agent → client)
 *   7. Graceful shutdown
 *
 * Per ACP spec, all communication is newline-delimited JSON-RPC 2.0
 * over stdin/stdout. stderr is for agent logging only.
 */

import { EventEmitter } from 'node:events';
import type {
  AcpAgentCapabilities,
  AcpInitializeResult,
  AcpJsonRpcNotification,
  AcpPermissionOutcome,
  AcpPermissionRequest,
  AcpSessionNewResult,
  AcpSessionUpdate,
  AcpStdioSpawnConfig,
  AcpStopReason,
} from '@tinker/shared-types';
import {
  createStdioTransport,
  type AgentRequest,
  type AcpStdioTransport,
  type CreateStdioTransportOptions,
} from './acp-stdio-transport.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentConnectionEvents = {
  session_update: [sessionId: string, update: AcpSessionUpdate];
  permission_request: [request: AcpPermissionRequest, respond: (outcome: AcpPermissionOutcome) => void];
  stderr: [text: string];
  error: [error: Error];
  close: [];
};

export type AgentConnectionState =
  | 'disconnected'
  | 'initializing'
  | 'ready'
  | 'closed'
  | 'errored';

export type PromptResult = {
  stopReason: AcpStopReason;
};

export type AgentSideConnection = {
  initialize(): Promise<AcpInitializeResult>;
  sessionNew(cwd: string): Promise<AcpSessionNewResult>;
  sessionLoad(sessionId: string, cwd: string): Promise<void>;
  prompt(sessionId: string, text: string): Promise<PromptResult>;
  cancel(sessionId: string): void;
  close(): void;
  readonly state: AgentConnectionState;
  readonly agentCapabilities: AcpAgentCapabilities | null;
  readonly pid: number | undefined;
  on<K extends keyof AgentConnectionEvents>(event: K, listener: (...args: AgentConnectionEvents[K]) => void): void;
  off<K extends keyof AgentConnectionEvents>(event: K, listener: (...args: AgentConnectionEvents[K]) => void): void;
};

const PROMPT_TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutes for long-running prompts

export type CreateAgentConnectionOptions = CreateStdioTransportOptions & {
  clientName?: string;
  clientVersion?: string;
  promptTimeoutMs?: number;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const createAgentSideConnection = (
  spawnConfig: AcpStdioSpawnConfig,
  options: CreateAgentConnectionOptions = {},
): AgentSideConnection => {
  const emitter = new EventEmitter();
  const transport: AcpStdioTransport = createStdioTransport(spawnConfig, options);
  let connectionState: AgentConnectionState = 'disconnected';
  let capabilities: AcpAgentCapabilities | null = null;

  const clientName = options.clientName ?? 'tinker';
  const clientVersion = options.clientVersion ?? '0.1.0';
  const promptTimeout = options.promptTimeoutMs ?? PROMPT_TIMEOUT_MS;

  // Route notifications from the transport
  transport.on('notification', (notification: AcpJsonRpcNotification) => {
    if (notification.method === 'session/update') {
      const params = notification.params as { sessionId?: string; update?: AcpSessionUpdate } | undefined;
      if (params?.sessionId && params.update) {
        emitter.emit('session_update', params.sessionId, params.update);
      }
      return;
    }

    // Notification-style permission request (no id — fire-and-forget from agent).
    if (notification.method === 'session/request_permission') {
      const params = notification.params as AcpPermissionRequest | undefined;
      if (params) {
        const respond = (outcome: AcpPermissionOutcome): void => {
          transport.notify('session/permission_response', {
            sessionId: params.sessionId,
            outcome,
          });
        };
        emitter.emit('permission_request', params, respond);
      }
      return;
    }
  });

  // Route agent-initiated JSON-RPC requests (with id + method).
  // Per spec, session/request_permission is a proper request that expects
  // a JSON-RPC response with the matching id.
  transport.on('agent_request', (request: AgentRequest) => {
    if (request.method === 'session/request_permission') {
      const params = request.params as AcpPermissionRequest | undefined;
      if (params) {
        const respond = (outcome: AcpPermissionOutcome): void => {
          transport.respond(request.id, { outcome });
        };
        emitter.emit('permission_request', params, respond);
      }
    }
  });

  transport.on('stderr', (text: string) => {
    emitter.emit('stderr', text);
  });

  transport.on('error', (err: Error) => {
    connectionState = 'errored';
    emitter.emit('error', err);
  });

  transport.on('close', () => {
    connectionState = 'closed';
    emitter.emit('close');
  });

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const initialize = async (): Promise<AcpInitializeResult> => {
    connectionState = 'initializing';

    const response = await transport.send('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: clientName, version: clientVersion },
    });

    if (response.error) {
      connectionState = 'errored';
      throw new Error(
        `ACP initialize failed: ${String(response.error.code)} ${response.error.message}`,
      );
    }

    const result = response.result as AcpInitializeResult;
    capabilities = result.agentCapabilities ?? null;
    connectionState = 'ready';
    return result;
  };

  const sessionNew = async (cwd: string): Promise<AcpSessionNewResult> => {
    const response = await transport.send('session/new', { cwd });
    if (response.error) {
      throw new Error(
        `ACP session/new failed: ${String(response.error.code)} ${response.error.message}`,
      );
    }
    return response.result as AcpSessionNewResult;
  };

  const sessionLoad = async (sessionId: string, cwd: string): Promise<void> => {
    const response = await transport.send('session/load', { sessionId, cwd });
    if (response.error) {
      throw new Error(
        `ACP session/load failed: ${String(response.error.code)} ${response.error.message}`,
      );
    }
  };

  const prompt = async (sessionId: string, text: string): Promise<PromptResult> => {
    const response = await transport.send('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    }, { timeoutMs: promptTimeout });

    if (response.error) {
      throw new Error(
        `ACP session/prompt error: ${String(response.error.code)} ${response.error.message}`,
      );
    }

    const result = response.result as { stopReason?: string } | undefined;
    return {
      stopReason: (result?.stopReason as AcpStopReason) ?? 'end_turn',
    };
  };

  const cancel = (sessionId: string): void => {
    transport.notify('session/cancel', { sessionId });
  };

  const close = (): void => {
    transport.close();
    connectionState = 'closed';
  };

  return {
    initialize,
    sessionNew,
    sessionLoad,
    prompt,
    cancel,
    close,
    get state() {
      return connectionState;
    },
    get agentCapabilities() {
      return capabilities;
    },
    get pid() {
      return transport.pid;
    },
    on: emitter.on.bind(emitter) as AgentSideConnection['on'],
    off: emitter.off.bind(emitter) as AgentSideConnection['off'],
  };
};
