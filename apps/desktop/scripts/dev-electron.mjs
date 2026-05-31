/**
 * Dev script: builds Electron main + preload with esbuild, starts
 * the Vite dev server, then launches Electron pointing at it.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const host = '127.0.0.1';
const port = 1420;
const devUrl = `http://${host}:${port}`;

const buildElectronSources = async () => {
  await build({
    entryPoints: [
      resolve(desktopDir, 'src/main/main.ts'),
      resolve(desktopDir, 'src/main/preload.ts'),
    ],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outdir: resolve(desktopDir, 'dist-electron'),
    outExtension: { '.js': '.mjs' },
    external: ['electron'],
    sourcemap: true,
  });
};

const waitForServer = async (url, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`Vite dev server did not start within ${timeoutMs}ms`);
};

// 1. Build Electron main + preload
process.stdout.write('Building Electron main + preload...\n');
await buildElectronSources();

// 2. Start Vite dev server
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const vite = spawn(pnpmCommand, ['exec', 'vite', '--host', host, '--port', String(port)], {
  cwd: desktopDir,
  stdio: 'inherit',
});

// 3. Wait for Vite to be ready
process.stdout.write(`Waiting for Vite dev server at ${devUrl}...\n`);
await waitForServer(devUrl);

// 4. Launch Electron
const electronBin = resolve(desktopDir, 'node_modules', '.bin', 'electron');
const electron = spawn(electronBin, [resolve(desktopDir, 'dist-electron/main.mjs')], {
  cwd: desktopDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
  },
});

electron.once('exit', (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

const forwardSignal = (signal) => {
  if (!electron.killed) electron.kill(signal);
  if (!vite.killed) vite.kill(signal);
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => forwardSignal(signal));
}
