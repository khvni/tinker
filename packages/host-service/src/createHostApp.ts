import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { platform as nodePlatform } from 'node:os';
import type {
  AbortRunRequest,
  AbortRunResponse,
  RunEvent,
  RunSummary,
  StartRunRequest,
  StartRunResponse,
} from '@tinker/shared-types';
import { extractBearerToken } from './auth.js';
import { createGooseRuntimeAdapter, createRunEventLog, type CreateAdapterOptions, type GooseRuntimeAdapter } from './goose/index.js';
import { loadHostIdentity, type LoadHostIdentityOptions } from './identity.js';
import type {
  HealthCheckResponse,
  HostAppHandle,
  HostConfig,
  HostInfoResponse,
  HostProviders,
  WorkspaceCurrentResponse,
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

const readQueryParam = (req: IncomingMessage, key: string): string | null => {
  const url = req.url ?? '';
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(url.slice(queryStart + 1));
  return params.get(key);
};

const readJsonBody = (req: IncomingMessage): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
};

const isStartRunRequest = (value: unknown): value is StartRunRequest => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['cwd'] === 'string' && typeof v['prompt'] === 'string';
};

const isAbortRunRequest = (value: unknown): value is AbortRunRequest => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['runId'] === 'string';
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

  const eventLog = createRunEventLog(config.runsDir);
  const adapterOptions: CreateAdapterOptions = { eventLog };
  if (config.gooseBin !== null) {
    adapterOptions.gooseBin = config.gooseBin;
  }
  const goose: GooseRuntimeAdapter = createGooseRuntimeAdapter(adapterOptions);

  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
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

    const requireAuth = (): boolean => {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return false;
      }
      return true;
    };

    if (matchPath(req, 'GET', '/host.info')) {
      if (!requireAuth()) return;

      const body: HostInfoResponse = {
        hostId: identity.hostId,
        hostName: identity.hostName,
        platform: nodePlatform(),
        version: HOST_SERVICE_VERSION,
        uptimeMs: Date.now() - startedAtMs,
        deviceCount: 1,
      };
      writeJson(res, 200, body, cors);
      return;
    }

    // --- Run endpoints (all PSK-authenticated) ---

    if (matchPath(req, 'POST', '/run.start')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        writeError(res, 400, 'Invalid JSON body.');
        return;
      }

      if (!isStartRunRequest(body)) {
        writeError(res, 400, 'Missing required fields: cwd, prompt.');
        return;
      }

      const runId = goose.startRun({
        cwd: body.cwd,
        prompt: body.prompt,
        mode: body.mode ?? null,
      });

      const response: StartRunResponse = { runId };
      writeJson(res, 200, response, cors);
      return;
    }

    if (matchPath(req, 'POST', '/run.abort')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        writeError(res, 400, 'Invalid JSON body.');
        return;
      }

      if (!isAbortRunRequest(body)) {
        writeError(res, 400, 'Missing required field: runId.');
        return;
      }

      const aborted = goose.abortRun(body.runId);
      const response: AbortRunResponse = { runId: body.runId, aborted };
      writeJson(res, 200, response, cors);
      return;
    }

    if (matchPath(req, 'GET', '/run.replay')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      const runId = readQueryParam(req, 'runId');
      if (typeof runId !== 'string' || runId.length === 0) {
        writeError(res, 400, 'Missing required query parameter: runId.');
        return;
      }

      const events: RunEvent[] = eventLog.replay(runId);
      writeJson(res, 200, { runId, events }, cors);
      return;
    }

    if (matchPath(req, 'GET', '/run.list')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      const summaries: RunSummary[] = eventLog.list();
      writeJson(res, 200, { runs: summaries }, cors);
      return;
    }

    if (matchPath(req, 'GET', '/run.events')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      const runId = readQueryParam(req, 'runId');
      if (typeof runId !== 'string' || runId.length === 0) {
        writeError(res, 400, 'Missing required query parameter: runId.');
        return;
      }

      res.writeHead(200, {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Replay existing events first
      const existing = eventLog.replay(runId);
      for (const event of existing) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      // Subscribe to new events
      const unsubscribe = goose.subscribe((event: RunEvent) => {
        if (event.runId !== runId) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        if (event.type === 'status' && (event.status === 'completed' || event.status === 'failed' || event.status === 'aborted')) {
          res.end();
          unsubscribe();
        }
      });

      // If the run is already terminal, close immediately
      const summary = eventLog.summary(runId);
      if (summary !== null && (summary.status === 'completed' || summary.status === 'failed' || summary.status === 'aborted')) {
        res.end();
        unsubscribe();
        return;
      }

      req.on('close', () => {
        unsubscribe();
      });
      return;
    }

    if (matchPath(req, 'GET', '/workspace.current')) {
      const token = extractBearerToken(req.headers.authorization);
      if (!providers.hostAuth.validate(token)) {
        writeError(res, 401, 'Invalid or missing PSK.');
        return;
      }

      const body: WorkspaceCurrentResponse = {
        hostId: identity.hostId,
        vaultRoot: config.vaultRoot,
        activeRuns: eventLog.list().filter(s => s.status === 'running').length,
        uptimeMs: Date.now() - startedAtMs,
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

    const next = createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        const message = err instanceof Error ? err.message : 'Internal server error.';
        if (!res.headersSent) {
          writeError(res, 500, message);
        }
      });
    });
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
    goose.shutdown();

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
