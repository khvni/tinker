/**
 * Typed device-side wrapper for `@tinker/host-service`.
 *
 * The renderer (and any future remote device) talks to the host through this
 * client only. Transport is plain `fetch`; reconnection and retry policy live
 * higher up the stack.
 */

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

export type HostClient = {
  healthCheck(): Promise<HealthCheckResponse>;
  hostInfo(): Promise<HostInfoResponse>;
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

export const createHostClient = (options: CreateHostClientOptions): HostClient => {
  const { secret } = options;
  const baseUrl = trimTrailingSlash(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('createHostClient requires a fetch implementation.');
  }

  const request = async <T>(path: string, guard: (value: unknown) => value is T, includeAuth: boolean): Promise<T> => {
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

  return {
    healthCheck: () => request('/health.check', isHealthCheckResponse, false),
    hostInfo: () => request('/host.info', isHostInfoResponse, true),
  };
};
