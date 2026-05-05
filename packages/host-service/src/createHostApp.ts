import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { platform as nodePlatform } from 'node:os';
import { extractBearerToken } from './auth.js';
import { loadHostIdentity, type LoadHostIdentityOptions } from './identity.js';
import type {
  HealthCheckResponse,
  HostAppHandle,
  HostConfig,
  HostInfoResponse,
  HostProviders,
} from './types.js';
import { HOST_SERVICE_VERSION } from './version.js';

export type CreateHostAppArgs = {
  config: HostConfig;
  providers: HostProviders;
  /** Test seam for identity persistence. Production callers omit this. */
  identityOptions?: LoadHostIdentityOptions;
};

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' } as const;

const writeJson = (res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void => {
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(body));
};

const writeError = (res: ServerResponse, status: number, message: string): void => {
  writeJson(res, status, { error: message });
};

const corsHeaders = (origin: string | undefined, allowed: readonly string[]): Record<string, string> => {
  if (typeof origin !== 'string' || origin.length === 0 || !allowed.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
};

const matchPath = (req: IncomingMessage, method: string, path: string): boolean => {
  if (req.method !== method) {
    return false;
  }

  const url = req.url ?? '';
  const queryStart = url.indexOf('?');
  const pathOnly = queryStart === -1 ? url : url.slice(0, queryStart);
  return pathOnly === path;
};

/**
 * Construct the host app. No listener is bound until `start()` is called.
 *
 * Per [[D22]] (no mutate-then-call managers): all configuration is captured
 * here and used per-request. Callers that need to retry pass a fresh config
 * object to a fresh `createHostApp`.
 */
export const createHostApp = (args: CreateHostAppArgs): HostAppHandle => {
  const { config, providers, identityOptions } = args;
  const identity = loadHostIdentity(identityOptions);
  const startedAtMs = Date.now();
  let server: Server | null = null;

  const handleRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const cors = corsHeaders(req.headers.origin, config.allowedOrigins);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (matchPath(req, 'GET', '/health.check')) {
      const body: HealthCheckResponse = {
        status: 'ok',
        hostId: identity.hostId,
        version: HOST_SERVICE_VERSION,
      };
      writeJson(res, 200, body, cors);
      return;
    }

    if (matchPath(req, 'GET', '/host.info')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      const body: HostInfoResponse = {
        hostId: identity.hostId,
        hostName: identity.hostName,
        platform: nodePlatform(),
        version: HOST_SERVICE_VERSION,
        uptimeMs: Date.now() - startedAtMs,
        // deviceCount is a v1 placeholder; real device tracking lands with the
        // device-pairing surface (out of scope for the foundation PR).
        deviceCount: 1,
      };
      writeJson(res, 200, body, cors);
      return;
    }

    writeError(res, 404, `Unknown route: ${req.method ?? 'UNKNOWN'} ${req.url ?? ''}`);
  };

  const start = async (): Promise<{ port: number; hostId: string }> => {
    if (server !== null) {
      throw new Error('Host app already started.');
    }

    const next = createServer(handleRequest);
    next.on('clientError', (_err, socket) => {
      if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => {
        next.off('listening', onListening);
        reject(err);
      };
      const onListening = (): void => {
        next.off('error', onError);
        resolve();
      };
      next.once('error', onError);
      next.once('listening', onListening);
      next.listen(config.listenPort, config.listenHost);
    });

    server = next;
    const address = next.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Listener returned an unexpected address shape.');
    }

    return { port: address.port, hostId: identity.hostId };
  };

  const stop = async (): Promise<void> => {
    const current = server;
    if (current === null) {
      return;
    }

    server = null;
    await new Promise<void>((resolve, reject) => {
      current.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

  return {
    hostId: identity.hostId,
    start,
    stop,
  };
};
