/**
 * ACP stdio JSON-RPC transport.
 *
 * Per ACP spec: the client spawns the agent as a subprocess and
 * communicates via stdin/stdout using newline-delimited JSON-RPC 2.0.
 * stderr is reserved for agent logging and is not parsed as protocol.
 *
 * This module handles the low-level framing: writing requests to stdin,
 * reading newline-delimited JSON-RPC messages from stdout, and routing
 * responses vs notifications to the correct handler.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type {
  AcpJsonRpcMessage,
  AcpJsonRpcNotification,
  AcpJsonRpcRequest,
  AcpJsonRpcResponse,
  AcpStdioSpawnConfig,
} from '@tinker/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentRequest = {
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

export type StdioTransportEvents = {
  notification: [AcpJsonRpcNotification];
  agent_request: [AgentRequest];
  error: [Error];
  close: [];
  stderr: [string];
};

type PendingRequest = {
  resolve: (response: AcpJsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export type SendOptions = {
  timeoutMs?: number;
};

export type AcpStdioTransport = {
  send(method: string, params?: Record<string, unknown>, options?: SendOptions): Promise<AcpJsonRpcResponse>;
  notify(method: string, params?: Record<string, unknown>): void;
  respond(id: number, result?: unknown, error?: { code: number; message: string; data?: unknown }): void;
  on<K extends keyof StdioTransportEvents>(event: K, listener: (...args: StdioTransportEvents[K]) => void): void;
  off<K extends keyof StdioTransportEvents>(event: K, listener: (...args: StdioTransportEvents[K]) => void): void;
  close(): void;
  readonly pid: number | undefined;
};

export type CreateStdioTransportOptions = {
  requestTimeoutMs?: number;
};

export const createStdioTransport = (
  config: AcpStdioSpawnConfig,
  options: CreateStdioTransportOptions = {},
): AcpStdioTransport => {
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const emitter = new EventEmitter();
  const pending = new Map<number, PendingRequest>();
  let nextId = 0;
  let closed = false;

  const child: ChildProcess = spawn(config.cmd, config.args as string[], {
    cwd: config.cwd,
    env: config.env ? { ...process.env, ...config.env } : { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl: ReadlineInterface = createInterface({ input: child.stdout! });

  rl.on('line', (line: string) => {
    if (line.length === 0) return;

    let msg: AcpJsonRpcMessage;
    try {
      msg = JSON.parse(line) as AcpJsonRpcMessage;
    } catch {
      return;
    }

    if ('id' in msg && typeof msg.id === 'number') {
      const entry = pending.get(msg.id);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(msg.id);
        entry.resolve(msg as AcpJsonRpcResponse);
        return;
      }
      // Agent-initiated request (has both id and method, e.g. session/request_permission)
      if ('method' in msg && typeof (msg as Record<string, unknown>).method === 'string') {
        emitter.emit('agent_request', {
          id: msg.id,
          method: (msg as Record<string, unknown>).method as string,
          params: (msg as Record<string, unknown>).params as Record<string, unknown> | undefined,
        });
      }
      return;
    }

    if ('method' in msg && !('id' in msg)) {
      emitter.emit('notification', msg as AcpJsonRpcNotification);
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    if (text.length > 0) {
      emitter.emit('stderr', text);
    }
  });

  child.on('error', (err: Error) => {
    emitter.emit('error', err);
  });

  child.on('close', () => {
    closed = true;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('ACP agent process exited.'));
    }
    pending.clear();
    emitter.emit('close');
  });

  const writeMessage = (msg: AcpJsonRpcRequest | AcpJsonRpcNotification): void => {
    if (closed || !child.stdin?.writable) {
      throw new Error('ACP stdio transport is closed.');
    }
    child.stdin.write(JSON.stringify(msg) + '\n');
  };

  const send = (method: string, params?: Record<string, unknown>, options?: SendOptions): Promise<AcpJsonRpcResponse> => {
    return new Promise<AcpJsonRpcResponse>((resolve, reject) => {
      const id = ++nextId;
      const request: AcpJsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        id,
        ...(params !== undefined ? { params } : {}),
      };

      const effectiveTimeout = options?.timeoutMs ?? timeoutMs;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`ACP RPC "${method}" timed out after ${String(effectiveTimeout)}ms.`));
      }, effectiveTimeout);

      pending.set(id, { resolve, reject, timer });

      try {
        writeMessage(request);
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };

  const respond = (id: number, result?: unknown, error?: { code: number; message: string; data?: unknown }): void => {
    const response: AcpJsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      ...(error !== undefined ? { error } : { result: result ?? null }),
    };
    if (closed || !child.stdin?.writable) {
      throw new Error('ACP stdio transport is closed.');
    }
    child.stdin.write(JSON.stringify(response) + '\n');
  };

  const notify = (method: string, params?: Record<string, unknown>): void => {
    const notification: AcpJsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined ? { params } : {}),
    };
    writeMessage(notification);
  };

  const close = (): void => {
    if (closed) return;
    closed = true;

    try {
      child.stdin?.end();
    } catch {
      // stdin may already be closed
    }

    child.kill('SIGTERM');
    const killTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already exited
      }
    }, 5_000);
    killTimer.unref();
  };

  return {
    send,
    notify,
    respond,
    on: emitter.on.bind(emitter) as AcpStdioTransport['on'],
    off: emitter.off.bind(emitter) as AcpStdioTransport['off'],
    close,
    get pid() {
      return child.pid;
    },
  };
};
