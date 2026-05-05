import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSharedSecretAuth } from './auth.js';
import { createHostApp } from './createHostApp.js';
import type {
  GitCredentialProvider,
  HostConfig,
  HostProviders,
  IntegrationCredentialWriter,
  ModelProviderResolver,
} from './types.js';
import { HOST_SERVICE_VERSION } from './version.js';

const stubCredentials: GitCredentialProvider = { resolve: async () => null };
const stubModelResolver: ModelProviderResolver = { envVars: async () => ({}) };
const stubSecretsWriter: IntegrationCredentialWriter = {
  write: async () => undefined,
  delete: async () => undefined,
};

const buildConfig = (overrides: Partial<HostConfig> = {}): HostConfig => ({
  dbPath: '/tmp/tinker-host-test.sqlite',
  vaultRoot: null,
  migrationsPath: '/tmp/tinker-host-test-migrations',
  allowedOrigins: [],
  listenHost: '127.0.0.1',
  listenPort: 0,
  ...overrides,
});

const buildProviders = (secret: string, overrides: Partial<HostProviders> = {}): HostProviders => ({
  hostAuth: createSharedSecretAuth(secret),
  credentials: stubCredentials,
  modelResolver: stubModelResolver,
  secretsWriter: stubSecretsWriter,
  ...overrides,
});

describe('createHostApp', () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'tinker-host-service-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('binds a free port and exposes hostId via /health.check without auth', async () => {
    const app = createHostApp({
      config: buildConfig(),
      providers: buildProviders('test-secret'),
      identityOptions: { identityDir: scratch },
    });

    const { port, hostId } = await app.start();
    try {
      expect(port).toBeGreaterThan(0);
      expect(hostId).toMatch(/^[0-9a-f]{16}$/u);

      const res = await fetch(`http://127.0.0.1:${port}/health.check`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok', hostId, version: HOST_SERVICE_VERSION });
    } finally {
      await app.stop();
    }
  });

  it('rejects /host.info without a valid PSK', async () => {
    const app = createHostApp({
      config: buildConfig(),
      providers: buildProviders('valid-secret'),
      identityOptions: { identityDir: scratch },
    });

    const { port } = await app.start();
    try {
      const missing = await fetch(`http://127.0.0.1:${port}/host.info`);
      expect(missing.status).toBe(401);

      const wrong = await fetch(`http://127.0.0.1:${port}/host.info`, {
        headers: { Authorization: 'Bearer nope' },
      });
      expect(wrong.status).toBe(401);
    } finally {
      await app.stop();
    }
  });

  it('returns full host.info payload when authenticated', async () => {
    const app = createHostApp({
      config: buildConfig(),
      providers: buildProviders('valid-secret'),
      identityOptions: { identityDir: scratch },
    });

    const { port, hostId } = await app.start();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/host.info`, {
        headers: { Authorization: 'Bearer valid-secret' },
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as Record<string, unknown>;
      expect(body['hostId']).toBe(hostId);
      expect(typeof body['hostName']).toBe('string');
      expect(typeof body['platform']).toBe('string');
      expect(body['version']).toBe(HOST_SERVICE_VERSION);
      expect(typeof body['uptimeMs']).toBe('number');
      expect(body['deviceCount']).toBe(1);
    } finally {
      await app.stop();
    }
  });

  it('returns 404 for unknown routes', async () => {
    const app = createHostApp({
      config: buildConfig(),
      providers: buildProviders('valid-secret'),
      identityOptions: { identityDir: scratch },
    });

    const { port } = await app.start();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/workspace.list`);
      expect(res.status).toBe(404);
    } finally {
      await app.stop();
    }
  });

  it('honors the CORS allowlist on preflight requests', async () => {
    const app = createHostApp({
      config: buildConfig({ allowedOrigins: ['https://allowed.example'] }),
      providers: buildProviders('valid-secret'),
      identityOptions: { identityDir: scratch },
    });

    const { port } = await app.start();
    try {
      const allowed = await fetch(`http://127.0.0.1:${port}/health.check`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://allowed.example', 'Access-Control-Request-Method': 'GET' },
      });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://allowed.example');

      const denied = await fetch(`http://127.0.0.1:${port}/health.check`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'GET' },
      });
      expect(denied.status).toBe(204);
      expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await app.stop();
    }
  });

  it('throws when start is called twice without stop', async () => {
    const app = createHostApp({
      config: buildConfig(),
      providers: buildProviders('valid-secret'),
      identityOptions: { identityDir: scratch },
    });

    await app.start();
    try {
      await expect(app.start()).rejects.toThrow(/already started/u);
    } finally {
      await app.stop();
    }
  });

  it('treats stop as idempotent before and after start', async () => {
    const app = createHostApp({
      config: buildConfig(),
      providers: buildProviders('valid-secret'),
      identityOptions: { identityDir: scratch },
    });

    await app.stop();
    await app.start();
    await app.stop();
    await app.stop();
  });
});
