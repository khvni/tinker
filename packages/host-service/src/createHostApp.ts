import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { platform as nodePlatform } from 'node:os';
import type { AbortRunRequest, ApprovalResponse, CreateRunRequest, PromptRunRequest, RunEvent } from '@tinker/shared-types';
import { extractBearerToken } from './auth.js';
import { loadHostIdentity, type LoadHostIdentityOptions } from './identity.js';
import { createRunManager } from './runs.js';
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
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

const writeJson = (res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void => {
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(body));
};

const writeError = (res: ServerResponse, status: number, message: string): void => {
  writeJson(res, status, { error: message });
};

const readJsonBody = (req: IncomingMessage): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(text.length > 0 ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const matchPathPrefix = (req: IncomingMessage, method: string, prefix: string): string | null => {
  if (req.method !== method) return null;
  const url = req.url ?? '';
  const queryStart = url.indexOf('?');
  const pathOnly = queryStart === -1 ? url : url.slice(0, queryStart);
  if (!pathOnly.startsWith(prefix)) return null;
  return pathOnly.slice(prefix.length);
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
  const runManager = createRunManager();
  let server: Server | null = null;

  const requireAuth = (req: IncomingMessage, res: ServerResponse, cors: Record<string, string>): boolean => {
    const token = extractBearerToken(req.headers.authorization);
    if (!providers.hostAuth.validate(token)) {
      writeError(res, 401, 'Invalid or missing PSK.');
      return false;
    }
    // suppress unused variable warning — cors is threaded through for future use
    void cors;
    return true;
  };

  const handleRunRoutes = (req: IncomingMessage, res: ServerResponse, cors: Record<string, string>): boolean => {
    if (matchPath(req, 'POST', '/runs.create')) {
      if (!requireAuth(req, res, cors)) return true;
      void readJsonBody(req).then((body) => {
        const parsed = isRecord(body) ? body : {};
        const run = runManager.create({
          title: typeof parsed['title'] === 'string' ? parsed['title'] : undefined,
          projectPath: typeof parsed['projectPath'] === 'string' ? parsed['projectPath'] : null,
          modelID: typeof parsed['modelID'] === 'string' ? parsed['modelID'] : undefined,
          providerID: typeof parsed['providerID'] === 'string' ? parsed['providerID'] : undefined,
        } satisfies CreateRunRequest);
        writeJson(res, 201, run, cors);
      }).catch(() => writeError(res, 400, 'Invalid JSON body.'));
      return true;
    }

    if (matchPath(req, 'GET', '/runs.list')) {
      if (!requireAuth(req, res, cors)) return true;
      writeJson(res, 200, runManager.list(), cors);
      return true;
    }

    const getRunId = matchPathPrefix(req, 'GET', '/runs.get/');
    if (getRunId !== null) {
      if (!requireAuth(req, res, cors)) return true;
      const run = runManager.get(getRunId);
      if (!run) {
        writeError(res, 404, `Run not found: ${getRunId}`);
        return true;
      }
      writeJson(res, 200, run, cors);
      return true;
    }

    if (matchPath(req, 'POST', '/runs.prompt')) {
      if (!requireAuth(req, res, cors)) return true;
      void readJsonBody(req).then((body) => {
        if (!isRecord(body) || typeof body['runId'] !== 'string' || typeof body['text'] !== 'string') {
          writeError(res, 400, 'Missing runId or text.');
          return;
        }
        const request: PromptRunRequest = {
          runId: body['runId'],
          text: body['text'],
          agent: typeof body['agent'] === 'string' ? body['agent'] : undefined,
          variant: typeof body['variant'] === 'string' ? body['variant'] : undefined,
        };
        if (isRecord(body['model'])) {
          const model = body['model'];
          if (typeof model['providerID'] === 'string' && typeof model['modelID'] === 'string') {
            request.model = { providerID: model['providerID'], modelID: model['modelID'] };
          }
        }
        runManager.prompt(request);
        writeJson(res, 200, { ok: true }, cors);
      }).catch(() => writeError(res, 400, 'Invalid JSON body.'));
      return true;
    }

    if (matchPath(req, 'POST', '/runs.abort')) {
      if (!requireAuth(req, res, cors)) return true;
      void readJsonBody(req).then((body) => {
        if (!isRecord(body) || typeof body['runId'] !== 'string') {
          writeError(res, 400, 'Missing runId.');
          return;
        }
        runManager.abort({ runId: body['runId'] } satisfies AbortRunRequest);
        writeJson(res, 200, { ok: true }, cors);
      }).catch(() => writeError(res, 400, 'Invalid JSON body.'));
      return true;
    }

    if (matchPath(req, 'POST', '/runs.approve')) {
      if (!requireAuth(req, res, cors)) return true;
      void readJsonBody(req).then((body) => {
        if (!isRecord(body) || typeof body['runId'] !== 'string' || typeof body['partID'] !== 'string' || typeof body['approved'] !== 'boolean') {
          writeError(res, 400, 'Missing runId, partID, or approved.');
          return;
        }
        runManager.respondToApproval({
          runId: body['runId'],
          partID: body['partID'],
          approved: body['approved'],
        } satisfies ApprovalResponse);
        writeJson(res, 200, { ok: true }, cors);
      }).catch(() => writeError(res, 400, 'Invalid JSON body.'));
      return true;
    }

    const eventsRunId = matchPathPrefix(req, 'GET', '/runs.events/');
    if (eventsRunId !== null) {
      if (!requireAuth(req, res, cors)) return true;
      const run = runManager.get(eventsRunId);
      if (!run) {
        writeError(res, 404, `Run not found: ${eventsRunId}`);
        return true;
      }
      res.writeHead(200, { ...SSE_HEADERS, ...cors });

      const sendEvent = (event: RunEvent): void => {
        if (res.destroyed) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = runManager.subscribe(eventsRunId, sendEvent);
      req.on('close', unsubscribe);
      return true;
    }

    const replayRunId = matchPathPrefix(req, 'GET', '/runs.replay/');
    if (replayRunId !== null) {
      if (!requireAuth(req, res, cors)) return true;
      const log = runManager.getEventLog(replayRunId);
      writeJson(res, 200, log, cors);
      return true;
    }

    return false;
  };

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
      if (!requireAuth(req, res, cors)) return;

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

    if (handleRunRoutes(req, res, cors)) return;

    if (matchPath(req, 'GET', '/workspace.current')) {
      if (!requireAuth(req, res, cors)) return;

      const body: WorkspaceCurrentResponse = {
        hostId: identity.hostId,
        vaultRoot: config.vaultRoot,
        activeRuns: runManager.list().filter(s => s.status === 'active').length,
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
