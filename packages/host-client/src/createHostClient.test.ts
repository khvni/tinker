import { describe, expect, it, vi } from 'vitest';
import { createHostClient, HostRequestError } from './createHostClient.js';
import { HOST_SERVICE_VERSION } from '@tinker/host-service';

const jsonResponse = (status: number, body: unknown): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const mockFetch = (impl: (input: string, init?: RequestInit) => Promise<Response>): typeof fetch =>
  vi.fn(impl) as unknown as typeof fetch;

describe('createHostClient', () => {
  it('calls /health.check without an Authorization header', async () => {
    const fetchImpl = mockFetch(async (_url, _init) =>
      jsonResponse(200, { status: 'ok', hostId: 'abcdef0123456789', version: HOST_SERVICE_VERSION }),
    );

    const client = createHostClient({
      baseUrl: 'http://127.0.0.1:51724',
      secret: 'unused',
      fetchImpl,
    });

    const result = await client.healthCheck();
    expect(result).toEqual({ status: 'ok', hostId: 'abcdef0123456789', version: HOST_SERVICE_VERSION });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:51724/health.check',
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    );
  });

  it('injects Authorization: Bearer <secret> on /host.info', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, {
        hostId: 'abcdef0123456789',
        hostName: 'devbox',
        platform: 'linux',
        version: HOST_SERVICE_VERSION,
        uptimeMs: 1234,
        deviceCount: 1,
      }),
    );

    const client = createHostClient({
      baseUrl: 'http://127.0.0.1:51724',
      secret: 'p$k-secret',
      fetchImpl,
    });

    const info = await client.hostInfo();
    expect(info.hostId).toBe('abcdef0123456789');
    expect(info.deviceCount).toBe(1);

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:51724/host.info',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer p$k-secret' }),
      }),
    );
  });

  it('throws HostRequestError on a non-OK response', async () => {
    const fetchImpl = mockFetch(async () => new Response('Forbidden', { status: 403 }));
    const client = createHostClient({ baseUrl: 'http://127.0.0.1:51724', secret: 'x', fetchImpl });

    await expect(client.hostInfo()).rejects.toMatchObject({
      name: 'HostRequestError',
      status: 403,
      path: '/host.info',
    });
  });

  it('throws HostRequestError when the response shape is wrong', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { unexpected: true }));
    const client = createHostClient({ baseUrl: 'http://127.0.0.1:51724', secret: 'x', fetchImpl });

    await expect(client.healthCheck()).rejects.toBeInstanceOf(HostRequestError);
  });

  it('maps fetch failures to status 0', async () => {
    const fetchImpl = mockFetch(async () => {
      throw new Error('connection refused');
    });
    const client = createHostClient({ baseUrl: 'http://127.0.0.1:51724', secret: 'x', fetchImpl });

    await expect(client.healthCheck()).rejects.toMatchObject({
      name: 'HostRequestError',
      status: 0,
    });
  });

  it('strips a trailing slash from baseUrl', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, { status: 'ok', hostId: 'abcdef0123456789', version: HOST_SERVICE_VERSION }),
    );

    const client = createHostClient({
      baseUrl: 'http://127.0.0.1:51724/',
      secret: 'unused',
      fetchImpl,
    });

    await client.healthCheck();
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:51724/health.check', expect.any(Object));
  });
});
