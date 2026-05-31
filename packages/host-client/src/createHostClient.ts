/**
 * Typed device-side wrapper for `@tinker/host-service`.
 *
 * The renderer (and any future remote device) talks to the host through this
 * client only. Transport is plain `fetch`; reconnection and retry policy live
 * higher up the stack.
 */

import type {
  AbortRunRequest,
  AbortRunResponse,
  RunEvent,
  RunSummary,
  StartRunRequest,
  StartRunResponse,
} from '@tinker/shared-types';

export type HealthCheckResponse = {
  status: 'ok';
  hostId: string;
  version: string;
};

export type HostInfoResponse = {
  hostId: string;
  hostName: string;
  platform: NodeJS.Platform;
  version: string;
  uptimeMs: number;
  deviceCount: number;
};

export type RunReplayResponse = {
  runId: string;
  events: RunEvent[];
};

export type RunListResponse = {
  runs: RunSummary[];
};

export type HostClient = {
  healthCheck(): Promise<HealthCheckResponse>;
  hostInfo(): Promise<HostInfoResponse>;
  startRun(request: StartRunRequest): Promise<StartRunResponse>;
  abortRun(request: AbortRunRequest): Promise<AbortRunResponse>;
  replayRun(runId: string): Promise<RunReplayResponse>;
  listRuns(): Promise<RunListResponse>;
  streamRunEvents(runId: string, onEvent: (event: RunEvent) => void): RunEventStream;
};

export type RunEventStream = {
  close(): void;
};

export type CreateHostClientOptions = {
  /** Base URL the host listens on, e.g. `http://127.0.0.1:51724`. No trailing slash. */
  baseUrl: string;
  /** PSK injected as `Authorization: Bearer <secret>`. */
  secret: string;
  /** Test seam for swapping `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
};

export class HostRequestError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(path: string, status: number, message: string) {
    super(`Host request failed (${path}, ${status}): ${message}`);
    this.name = 'HostRequestError';
    this.status = status;
    this.path = path;
  }
}

const trimTrailingSlash = (value: string): string => {
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const isHealthCheckResponse = (value: unknown): value is HealthCheckResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate['status'] === 'ok' &&
    typeof candidate['hostId'] === 'string' &&
    typeof candidate['version'] === 'string'
  );
};

const isHostInfoResponse = (value: unknown): value is HostInfoResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['hostId'] === 'string' &&
    typeof candidate['hostName'] === 'string' &&
    typeof candidate['platform'] === 'string' &&
    typeof candidate['version'] === 'string' &&
    typeof candidate['uptimeMs'] === 'number' &&
    typeof candidate['deviceCount'] === 'number'
  );
};

const isStartRunResponse = (value: unknown): value is StartRunResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['runId'] === 'string';
};

const isAbortRunResponse = (value: unknown): value is AbortRunResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['runId'] === 'string' && typeof candidate['aborted'] === 'boolean';
};

const isRunReplayResponse = (value: unknown): value is RunReplayResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['runId'] === 'string' && Array.isArray(candidate['events']);
};

const isRunListResponse = (value: unknown): value is RunListResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate['runs']);
};

export const createHostClient = (options: CreateHostClientOptions): HostClient => {
  const { secret } = options;
  const baseUrl = trimTrailingSlash(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('createHostClient requires a fetch implementation.');
  }

  const get = async <T>(path: string, guard: (value: unknown) => value is T, includeAuth: boolean): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (includeAuth) {
      headers['Authorization'] = `Bearer ${secret}`;
    }

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, { method: 'GET', headers });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'fetch failed';
      throw new HostRequestError(path, 0, message);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HostRequestError(path, response.status, text || response.statusText);
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!guard(payload)) {
      throw new HostRequestError(path, response.status, 'Unexpected response shape.');
    }

    return payload;
  };

  const post = async <T>(path: string, body: unknown, guard: (value: unknown) => value is T): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${secret}`,
    };

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'fetch failed';
      throw new HostRequestError(path, 0, message);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HostRequestError(path, response.status, text || response.statusText);
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!guard(payload)) {
      throw new HostRequestError(path, response.status, 'Unexpected response shape.');
    }

    return payload;
  };

  const streamRunEvents = (runId: string, onEvent: (event: RunEvent) => void): RunEventStream => {
    const controller = new AbortController();

    const connect = async (): Promise<void> => {
      const url = `${baseUrl}/run.events?runId=${encodeURIComponent(runId)}`;
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${secret}`,
      };

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } catch {
        return;
      }

      if (!response.ok || response.body === null) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as RunEvent;
                onEvent(event);
              } catch {
                // skip malformed SSE data
              }
            }
          }
        }
      } catch {
        // stream closed or aborted
      }
    };

    void connect();

    return {
      close() {
        controller.abort();
      },
    };
  };

  return {
    healthCheck: () => get('/health.check', isHealthCheckResponse, false),
    hostInfo: () => get('/host.info', isHostInfoResponse, true),
    startRun: (request) => post('/run.start', request, isStartRunResponse),
    abortRun: (request) => post('/run.abort', request, isAbortRunResponse),
    replayRun: (runId) => get(`/run.replay?runId=${encodeURIComponent(runId)}`, isRunReplayResponse, true),
    listRuns: () => get('/run.list', isRunListResponse, true),
    streamRunEvents,
  };
};
