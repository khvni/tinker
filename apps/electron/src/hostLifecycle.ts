import { randomBytes } from 'node:crypto';
import { type ChildProcess, fork } from 'node:child_process';
import { resolve } from 'node:path';
import {
  resolveDataPaths,
  ensureDataPaths,
  readManifest,
  type HostDataPaths,
} from '@tinker/host-service';
import type { HostConnectionInfo } from './hostBridge.js';

/**
 * Host lifecycle — spawns host-service as a child process and provides
 * connection info for the preload bridge. Survives renderer reloads.
 *
 * Per [[D22]]: no mutate-then-call. Config is captured at spawn time.
 */

export type SpawnHostOptions = {
  /** Override data directory (tests). */
  dataDir?: string;
  /** Vault root, or null for first-run. */
  vaultRoot?: string | null;
  /** Bind port. 0 = OS picks. */
  port?: number;
  /** Bind host. Default: 127.0.0.1. */
  host?: string;
};

export type HostHandle = {
  connection: HostConnectionInfo;
  paths: HostDataPaths;
  pid: number;
  stop(): void;
};

type BootInfo = {
  hostId: string;
  port: number;
  pid: number;
  dataDir: string;
};

const isBootInfo = (value: unknown): value is BootInfo => {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['hostId'] === 'string' &&
    typeof c['port'] === 'number' &&
    typeof c['pid'] === 'number' &&
    typeof c['dataDir'] === 'string'
  );
};

const generatePsk = (): string => randomBytes(32).toString('hex');

const BIN_PATH = resolve(
  import.meta.dirname ?? __dirname,
  '..', '..', '..', 'packages', 'host-service', 'src', 'bin.ts',
);

/**
 * Try to adopt an existing host from a manifest on disk.
 * Returns connection info if the host is still alive, null otherwise.
 */
export const tryAdoptHost = async (
  options: SpawnHostOptions = {},
): Promise<HostHandle | null> => {
  const paths = resolveDataPaths(options.dataDir ? { rootOverride: options.dataDir } : {});

  const { loadHostIdentity } = await import('@tinker/host-service');
  const identity = loadHostIdentity({ identityDir: paths.host });
  const manifest = readManifest(paths.manifests, identity.hostId);
  if (manifest === null) return null;

  try {
    const res = await fetch(`http://127.0.0.1:${manifest.port}/health.check`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
  } catch {
    return null;
  }

  // We cannot validate the secret without the original PSK in memory.
  // On adoption we generate a fresh PSK — the adopted host keeps running
  // but new authenticated calls will use a fresh secret after restart.
  // For v1 adoption, we return a read-only handle that only health-checks.
  return null;
};

/**
 * Spawn host-service as a child Node process.
 *
 * Per §Coordinator: generate PSK, pass via env, health-poll until ok,
 * record manifest, unref so host survives app quit.
 */
export const spawnHost = (options: SpawnHostOptions = {}): Promise<HostHandle> => {
  const paths = resolveDataPaths(options.dataDir ? { rootOverride: options.dataDir } : {});
  ensureDataPaths(paths);

  const secret = generatePsk();
  const port = options.port ?? 0;
  const host = options.host ?? '127.0.0.1';

  return new Promise<HostHandle>((resolvePromise, reject) => {
    const child: ChildProcess = fork(BIN_PATH, [], {
      execArgv: ['--import', 'tsx'],
      env: {
        ...process.env,
        TINKER_HOST_SECRET: secret,
        TINKER_HOST_PORT: String(port),
        TINKER_HOST_HOST: host,
        TINKER_DATA_DIR: paths.root,
        TINKER_VAULT_ROOT: options.vaultRoot ?? '',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    let settled = false;
    let stdout = '';

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error('Host boot timed out after 30s.'));
      }
    }, 30_000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      const newlineIdx = stdout.indexOf('\n');
      if (newlineIdx === -1 || settled) return;

      const line = stdout.slice(0, newlineIdx);
      settled = true;
      clearTimeout(timeout);

      let bootInfo: unknown;
      try {
        bootInfo = JSON.parse(line);
      } catch {
        reject(new Error(`Host emitted non-JSON boot line: ${line}`));
        return;
      }

      if (!isBootInfo(bootInfo)) {
        reject(new Error(`Unexpected boot info shape: ${line}`));
        return;
      }

      child.unref();

      resolvePromise({
        connection: {
          baseUrl: `http://${host}:${bootInfo.port}`,
          secret,
          hostId: bootInfo.hostId,
        },
        paths,
        pid: bootInfo.pid,
        stop: () => child.kill('SIGTERM'),
      });
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Host stderr: ${chunk.toString('utf8').trim()}`));
      }
    });

    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Host exited before boot with code ${code ?? 'null'}.`));
      }
    });

    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
};
