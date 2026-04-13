import { app, ipcMain, type IpcMain } from 'electron';
import { existsSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOpencode } from '@opencode-ai/sdk/v2';

const OPENCODE_START_TIMEOUT_MS = 15_000;

export const OPENCODE_IPC_CHANNELS = {
  health: 'opencode:health',
} as const;

type OpencodeRuntime = Awaited<ReturnType<typeof createOpencode>>;

export type OpencodeClient = OpencodeRuntime['client'];
export type OpencodeHealth = Awaited<
  ReturnType<OpencodeRuntime['client']['global']['health']>
>['data'];

let runtime: OpencodeRuntime | null = null;
let runtimePromise: Promise<OpencodeRuntime> | null = null;

const opencodeBinDirectories = [
  resolve(process.cwd(), 'node_modules/.bin'),
  resolve(import.meta.dirname, '../../node_modules/.bin'),
  resolve(import.meta.dirname, '../../../node_modules/.bin'),
  resolve(import.meta.dirname, '../../../../node_modules/.bin'),
];

const ensureOpencodeBinaryOnPath = (): void => {
  const currentPath = process.env.PATH ?? '';
  const currentEntries = currentPath.length > 0 ? currentPath.split(delimiter) : [];
  const nextEntries = opencodeBinDirectories.filter((directory) => existsSync(directory));

  process.env.PATH = [...new Set([...nextEntries, ...currentEntries])].join(delimiter);
};

const readHealth = async (client: OpencodeClient): Promise<OpencodeHealth> => {
  const response = await client.global.health();
  const health = response.data;

  if (!health) {
    throw new Error('OpenCode health check returned no payload');
  }

  if (!health.healthy) {
    throw new Error('OpenCode health check returned unhealthy status');
  }

  return health;
};

const isDirectElectronEntry = (): boolean => {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entrypoint)).href;
};

const shouldRunStandaloneHealthCheck = (): boolean => {
  return process.env.GLASS_OPENCODE_STANDALONE === '1' || isDirectElectronEntry();
};

export const startOpencode = async (): Promise<OpencodeRuntime> => {
  if (runtime) {
    return runtime;
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      ensureOpencodeBinaryOnPath();

      const started = await createOpencode({
        timeout: OPENCODE_START_TIMEOUT_MS,
      });

      await readHealth(started.client);
      runtime = started;
      return started;
    })().catch((error: unknown) => {
      runtime = null;
      runtimePromise = null;
      throw error;
    });
  }

  return runtimePromise;
};

export const getOpencodeClient = async (): Promise<OpencodeClient> => {
  const started = await startOpencode();
  return started.client;
};

export const getOpencodeHealth = async (): Promise<OpencodeHealth> => {
  return readHealth(await getOpencodeClient());
};

export const stopOpencode = async (): Promise<void> => {
  const started = runtime ?? (runtimePromise ? await runtimePromise.catch(() => null) : null);

  runtime = null;
  runtimePromise = null;

  if (!started) {
    return;
  }

  await started.server.close();
};

export const registerOpencodeIpcHandlers = (ipc: IpcMain = ipcMain): void => {
  ipc.removeHandler(OPENCODE_IPC_CHANNELS.health);
  ipc.handle(OPENCODE_IPC_CHANNELS.health, async () => getOpencodeHealth());
};

export const bootstrapOpencodeOnAppLaunch = (ipc: IpcMain = ipcMain): void => {
  registerOpencodeIpcHandlers(ipc);

  const launch = (): void => {
    void startOpencode().catch((error: unknown) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      console.error(`[opencode] failed to start: ${message}`);
    });
  };

  if (app.isReady()) {
    launch();
  } else {
    app.once('ready', launch);
  }

  app.once('before-quit', () => {
    void stopOpencode();
  });
};

const runStandaloneHealthCheck = async (): Promise<void> => {
  await app.whenReady();

  try {
    const health = await getOpencodeHealth();
    process.stdout.write(`${JSON.stringify(health)}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    await stopOpencode();
    app.quit();
  }
};

if (shouldRunStandaloneHealthCheck()) {
  void runStandaloneHealthCheck();
}
