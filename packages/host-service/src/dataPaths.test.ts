import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDataPaths, resolveDataPaths } from './dataPaths.js';

describe('resolveDataPaths', () => {
  it('resolves macOS paths under ~/Library/Application Support/Tinker', () => {
    const paths = resolveDataPaths({ platformOverride: 'darwin' });
    expect(paths.root).toContain(join('Library', 'Application Support', 'Tinker'));
    expect(paths.runs).toBe(join(paths.root, 'runs'));
    expect(paths.manifests).toBe(join(paths.root, 'host', 'manifests'));
  });

  it('resolves Windows paths under AppData/Roaming/Tinker', () => {
    const paths = resolveDataPaths({ platformOverride: 'win32' });
    expect(paths.root).toContain('Tinker');
  });

  it('resolves Linux paths under ~/.local/share/tinker', () => {
    const paths = resolveDataPaths({ platformOverride: 'linux' });
    expect(paths.root).toContain(join('.local', 'share', 'tinker'));
  });

  it('uses rootOverride when provided', () => {
    const paths = resolveDataPaths({ rootOverride: '/custom/dir' });
    expect(paths.root).toBe('/custom/dir');
    expect(paths.db).toBe(join('/custom/dir', 'db'));
    expect(paths.memory).toBe(join('/custom/dir', 'memory'));
  });

  it('includes all expected subdirectories', () => {
    const paths = resolveDataPaths({ rootOverride: '/test' });
    expect(paths.host).toBe(join('/test', 'host'));
    expect(paths.manifests).toBe(join('/test', 'host', 'manifests'));
    expect(paths.runs).toBe(join('/test', 'runs'));
    expect(paths.notes).toBe(join('/test', 'notes'));
    expect(paths.memory).toBe(join('/test', 'memory'));
    expect(paths.workspaces).toBe(join('/test', 'workspaces'));
    expect(paths.db).toBe(join('/test', 'db'));
  });
});

describe('ensureDataPaths', () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'tinker-datapaths-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('creates all subdirectories', () => {
    const paths = resolveDataPaths({ rootOverride: scratch });
    ensureDataPaths(paths);

    expect(existsSync(paths.host)).toBe(true);
    expect(existsSync(paths.manifests)).toBe(true);
    expect(existsSync(paths.runs)).toBe(true);
    expect(existsSync(paths.notes)).toBe(true);
    expect(existsSync(paths.memory)).toBe(true);
    expect(existsSync(paths.workspaces)).toBe(true);
    expect(existsSync(paths.db)).toBe(true);
  });

  it('is idempotent', () => {
    const paths = resolveDataPaths({ rootOverride: scratch });
    ensureDataPaths(paths);
    ensureDataPaths(paths);
    expect(existsSync(paths.db)).toBe(true);
  });
});
