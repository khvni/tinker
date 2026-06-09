/**
 * Typed device-side wrapper for `@tinker/host-service`.
 *
 * The renderer (and any future remote device) talks to the host through this
 * client only. Transport is plain `fetch`; reconnection and retry policy live
 * higher up the stack.
 */

import type {
  AbortRunRequest,
  ApprovalResponse,
  CreateRunRequest,
  PromptRunRequest,
  Run,
  RunEvent,
  StoredRunEvent,
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

export type RunEventCallback = (event: RunEvent) => void;

export type RunEventStream = {
  close(): void;
};

export type WorkspaceCurrentResponse = {
  hostId: string;
  vaultRoot: string | null;
  activeRuns: number;
  uptimeMs: number;
};

export type HostClient = {
  healthCheck(): Promise<HealthCheckResponse>;
  hostInfo(): Promise<HostInfoResponse>;
  runs: {
    create(request: CreateRunRequest): Promise<Run>;
    get(runId: string): Promise<Run>;
    list(): Promise<Run[]>;
    prompt(request: PromptRunRequest): Promise<void>;
    abort(request: AbortRunRequest): Promise<void>;
    approve(response: ApprovalResponse): Promise<void>;
    subscribe(runId: string, callback: RunEventCallback): RunEventStream;
    replay(runId: string): Promise<StoredRunEvent[]>;
  };
  workspaceCurrent(): Promise<WorkspaceCurrentResponse>;
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

const isRun = (value: unknown): value is Run => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['status'] === 'string' &&
    typeof candidate['createdAt'] === 'string'
  );
};

const isRunArray = (value: unknown): value is Run[] => {
  return Array.isArray(value) && value.every(isRun);
};

const isStoredRunEventArray = (value: unknown): value is StoredRunEvent[] => {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate['ts'] === 'string' && typeof candidate['event'] === 'object';
  });
};

const isOkResponse = (value: unknown): value is { ok: boolean } => {
  if (typeof value !== 'object' || value === null) return false;
  return (value as Record<string, unknown>)['ok'] === true;
};

const isWorkspaceCurrentResponse = (value: unknown): value is WorkspaceCurrentResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['hostId'] === 'string' &&
    (typeof candidate['vaultRoot'] === 'string' || candidate['vaultRoot'] === null) &&
    typeof candidate['activeRuns'] === 'number' &&
    typeof candidate['uptimeMs'] === 'number'
  );
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

  const subscribeSSE = (path: string, callback: RunEventCallback): RunEventStream => {
    const url = `${baseUrl}${path}`;
    const eventSource = new EventSource(url);
    let closed = false;

    eventSource.onmessage = (event: MessageEvent<string>) => {
      if (closed) return;
      try {
        const parsed = JSON.parse(event.data) as RunEvent;
        callback(parsed);
      } catch {
        // skip malformed events
      }
    };

    eventSource.onerror = () => {
      if (closed) return;
      // SSE auto-reconnects; no action needed
    };

    return {
      close: () => {
        closed = true;
        eventSource.close();
      },
    };
  };

  const runs: HostClient['runs'] = {
    create: (req) => post('/runs.create', req, isRun),
    get: (runId) => get(`/runs.get/${runId}`, isRun, true),
    list: () => get('/runs.list', isRunArray, true),
    prompt: async (req) => { await post('/runs.prompt', req, isOkResponse); },
    abort: async (req) => { await post('/runs.abort', req, isOkResponse); },
    approve: async (req) => { await post('/runs.approve', req, isOkResponse); },
    subscribe: (runId, callback) => subscribeSSE(`/runs.events/${runId}`, callback),
    replay: (runId) => get(`/runs.replay/${runId}`, isStoredRunEventArray, true),
  };

  return {
    healthCheck: () => get('/health.check', isHealthCheckResponse, false),
    hostInfo: () => get('/host.info', isHostInfoResponse, true),
    runs,
    workspaceCurrent: () => get('/workspace.current', isWorkspaceCurrentResponse, true),
  };
};
