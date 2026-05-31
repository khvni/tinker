/**
 * Production build: compiles Electron main + preload with esbuild,
 * then builds the Vite renderer.
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

// 1. Build Electron main + preload
process.stdout.write('Building Electron main + preload...\n');
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
  minify: true,
});

// 2. Build Vite renderer
process.stdout.write('Building renderer with Vite...\n');
execFileSync(pnpmCommand, ['exec', 'vite', 'build'], {
  cwd: desktopDir,
  stdio: 'inherit',
});

process.stdout.write('Build complete.\n');
