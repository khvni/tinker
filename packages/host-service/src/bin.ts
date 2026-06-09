#!/usr/bin/env node

/**
 * CLI entrypoint — spawned by Electron main (or any launcher) as a child process.
 *
 * Reads config from environment variables:
 *   TINKER_HOST_PORT   — bind port (default: 0 = OS picks)
 *   TINKER_HOST_SECRET — PSK for bearer auth (required)
 *   TINKER_HOST_HOST   — bind host (default: 127.0.0.1)
 *   TINKER_DATA_DIR    — override root data directory
 *   TINKER_VAULT_ROOT  — vault path, or empty for first-run
 *
 * On startup: resolves data paths, writes adoption manifest, starts the server,
 * then prints a JSON boot line to stdout for the launcher to parse.
 */

import { createHostApp } from './createHostApp.js';
import { createSharedSecretAuth } from './auth.js';
import { resolveDataPaths, ensureDataPaths } from './dataPaths.js';
import { writeManifest } from './manifest.js';
import type {
  GitCredentialProvider,
  HostConfig,
  HostProviders,
  IntegrationCredentialWriter,
  ModelProviderResolver,
} from './types.js';

const secret = process.env['TINKER_HOST_SECRET'];
if (typeof secret !== 'string' || secret.length === 0) {
  process.stderr.write('TINKER_HOST_SECRET is required.\n');
  process.exit(1);
}

const port = parseInt(process.env['TINKER_HOST_PORT'] ?? '0', 10);
const host = process.env['TINKER_HOST_HOST'] ?? '127.0.0.1';
const vaultRoot = process.env['TINKER_VAULT_ROOT'] ?? null;
const dataDir = process.env['TINKER_DATA_DIR'] ?? undefined;

const paths = resolveDataPaths(dataDir ? { rootOverride: dataDir } : {});
ensureDataPaths(paths);

const stubCredentials: GitCredentialProvider = { resolve: async () => null };
const stubModelResolver: ModelProviderResolver = { envVars: async () => ({}) };
const stubSecretsWriter: IntegrationCredentialWriter = {
  write: async () => undefined,
  delete: async () => undefined,
};

const config: HostConfig = {
  dbPath: `${paths.db}/tinker.sqlite`,
  vaultRoot: vaultRoot === '' ? null : vaultRoot,
  migrationsPath: `${paths.db}/migrations`,
  runsDir: `${paths.host}/runs`,
  allowedOrigins: [],
  listenHost: host,
  listenPort: port,
  gooseBin: null,
};

const providers: HostProviders = {
  hostAuth: createSharedSecretAuth(secret),
  credentials: stubCredentials,
  modelResolver: stubModelResolver,
  secretsWriter: stubSecretsWriter,
};

const app = createHostApp({ config, providers, identityOptions: { identityDir: paths.host } });

const boot = async (): Promise<void> => {
  const result = await app.start();

  writeManifest({
    manifestDir: paths.manifests,
    hostId: result.hostId,
    pid: process.pid,
    port: result.port,
    secret,
  });

  const bootInfo = {
    hostId: result.hostId,
    port: result.port,
    pid: process.pid,
    dataDir: paths.root,
  };
  process.stdout.write(`${JSON.stringify(bootInfo)}\n`);

  const shutdown = async (): Promise<void> => {
    await app.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
};

boot().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'unknown error';
  process.stderr.write(`Host boot failed: ${message}\n`);
  process.exit(1);
});
