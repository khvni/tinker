import { access, chmod, copyFile, mkdir, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const binariesDir = resolve(desktopDir, 'src-tauri', 'binaries');
const resourcesDir = resolve(desktopDir, 'src-tauri', 'resources');
const repoRoot = resolve(desktopDir, '..', '..');
const opencodePackageDir = dirname(require.resolve('opencode-ai/package.json'));
const authSidecarEntry = resolve(repoRoot, 'packages', 'auth-sidecar', 'dist', 'auth-sidecar.mjs');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const targets = [
  {
    packageName: 'opencode-darwin-arm64',
    triple: 'aarch64-apple-darwin',
    binary: 'opencode',
  },
  {
    packageName: 'opencode-darwin-x64',
    triple: 'x86_64-apple-darwin',
    binary: 'opencode',
  },
  {
    packageName: 'opencode-linux-x64',
    triple: 'x86_64-unknown-linux-gnu',
    binary: 'opencode',
  },
  {
    packageName: 'opencode-linux-arm64',
    triple: 'aarch64-unknown-linux-gnu',
    binary: 'opencode',
  },
  {
    packageName: 'opencode-windows-x64',
    triple: 'x86_64-pc-windows-msvc',
    binary: 'opencode.exe',
  },
];

const copiedTargets = [];

const currentTriple = (() => {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'aarch64-apple-darwin';
  }

  if (process.platform === 'darwin' && process.arch === 'x64') {
    return 'x86_64-apple-darwin';
  }

  if (process.platform === 'linux' && process.arch === 'arm64') {
    return 'aarch64-unknown-linux-gnu';
  }

  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'x86_64-unknown-linux-gnu';
  }

  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'x86_64-pc-windows-msvc';
  }

  throw new Error(`Unsupported build host for desktop sidecars: ${process.platform}/${process.arch}`);
})();

await execFileAsync(pnpmCommand, ['--filter', '@tinker/auth-sidecar', 'build'], {
  cwd: repoRoot,
});

await mkdir(binariesDir, { recursive: true });
await mkdir(resourcesDir, { recursive: true });

for (const target of targets) {
  const source = resolve(opencodePackageDir, '..', target.packageName, 'bin', target.binary);

  try {
    await access(source);
  } catch {
    continue;
  }

  const destination = resolve(
    binariesDir,
    `opencode-${target.triple}${target.binary.endsWith('.exe') ? '.exe' : ''}`,
  );

  await copyFile(source, destination);
  if (!destination.endsWith('.exe')) {
    await chmod(destination, 0o755);
  }

  copiedTargets.push(target.triple);
}

if (copiedTargets.length === 0) {
  throw new Error('No OpenCode sidecar binaries were found in node_modules.');
}

const nodeSource = await realpath(process.execPath);
const nodeDestination = resolve(
  binariesDir,
  `node-${currentTriple}${process.platform === 'win32' ? '.exe' : ''}`,
);

await copyFile(nodeSource, nodeDestination);
if (process.platform !== 'win32') {
  await chmod(nodeDestination, 0o755);
}

await access(authSidecarEntry);
await copyFile(authSidecarEntry, resolve(resourcesDir, 'auth-sidecar.mjs'));

process.stdout.write(
  `Prepared OpenCode sidecar binaries for: ${copiedTargets.join(', ')}\nPrepared auth sidecar resources for: ${currentTriple}\n`,
);
