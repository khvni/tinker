import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { discoverAcpConnectors, type AcpDiscoveryResult } from './acp-discovery.js';

/**
 * The discovery module shells out to `which` / `goose --version` and reads
 * a config file. In tests we stub `child_process.execFile` and
 * `fs/promises.access` / `fs/promises.readFile` so no real binaries are
 * needed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
   vi.mock requires loose typing for the factory callback. */

const execFileMock = vi.fn();
const accessMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => execFileMock(...args),
}));

vi.mock('node:fs/promises', () => ({
  access: (...args: any[]) => accessMock(...args),
  readFile: (...args: any[]) => readFileMock(...args),
}));

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Helper to make execFileMock resolve/reject for specific command+args combos.
 */
const setupExecFile = (
  responses: Record<string, { stdout?: string; error?: boolean }>,
) => {
  execFileMock.mockImplementation(
    (
      cmd: string,
      args: string[],
      _opts: Record<string, unknown>,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      const key = `${cmd} ${args.join(' ')}`;
      const entry = responses[key];
      if (entry?.error) {
        cb(new Error('not found'), '', '');
      } else {
        cb(null, entry?.stdout ?? '', '');
      }
    },
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  accessMock.mockRejectedValue(new Error('no file'));
  readFileMock.mockRejectedValue(new Error('no file'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discoverAcpConnectors', () => {
  it('reports all connectors as unavailable when goose is not installed', async () => {
    setupExecFile({
      'which goose': { error: true },
      'where goose': { error: true },
      'goose --version': { error: true },
      'which claude': { error: true },
      'where claude': { error: true },
      'which codex': { error: true },
      'where codex': { error: true },
      'which opencode': { error: true },
      'where opencode': { error: true },
    });

    const result: AcpDiscoveryResult = await discoverAcpConnectors();

    expect(result.goose.installed).toBe(false);
    expect(result.goose.version).toBeNull();
    expect(result.goose.message).toContain('not installed');

    for (const connector of result.connectors) {
      expect(connector.status).toBe('unavailable');
      expect(connector.message).toContain('Goose');
    }
  });

  it('detects goose installed and connectors not installed', async () => {
    setupExecFile({
      'which goose': { stdout: '/usr/local/bin/goose\n' },
      'goose --version': { stdout: 'goose 1.2.3\n' },
      'which claude': { error: true },
      'where claude': { error: true },
      'which codex': { error: true },
      'where codex': { error: true },
      'which opencode': { error: true },
      'where opencode': { error: true },
    });

    const result = await discoverAcpConnectors();

    expect(result.goose.installed).toBe(true);
    expect(result.goose.version).toBe('goose 1.2.3');

    for (const connector of result.connectors) {
      expect(connector.status).toBe('not-installed');
    }
  });

  it('detects installed-but-unconfigured connectors', async () => {
    setupExecFile({
      'which goose': { stdout: '/usr/local/bin/goose\n' },
      'goose --version': { stdout: 'goose 2.0.0\n' },
      'which claude': { stdout: '/usr/local/bin/claude\n' },
      'which codex': { error: true },
      'where codex': { error: true },
      'which opencode': { stdout: '/usr/local/bin/opencode\n' },
    });

    const result = await discoverAcpConnectors();

    const claude = result.connectors.find((c) => c.id === 'claude-code');
    expect(claude?.status).toBe('detected');

    const codex = result.connectors.find((c) => c.id === 'codex');
    expect(codex?.status).toBe('not-installed');

    const opencode = result.connectors.find((c) => c.id === 'opencode');
    expect(opencode?.status).toBe('detected');
  });

  it('reports configured status when profiles.yaml references the provider', async () => {
    setupExecFile({
      'which goose': { stdout: '/usr/local/bin/goose\n' },
      'goose --version': { stdout: 'goose 2.0.0\n' },
      'which claude': { stdout: '/usr/local/bin/claude\n' },
      'which codex': { error: true },
      'where codex': { error: true },
      'which opencode': { error: true },
      'where opencode': { error: true },
    });

    // Stub profiles.yaml to contain the claude-code provider id
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue('provider: claude-code\nmodel: claude-sonnet-4');

    const result = await discoverAcpConnectors();

    const claude = result.connectors.find((c) => c.id === 'claude-code');
    expect(claude?.status).toBe('configured');
    expect(claude?.message).toBeNull();
  });
});
