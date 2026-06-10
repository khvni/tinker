import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { discoverAcpConnectors, type AcpDiscoveryResult } from './acp-discovery.js';

/**
 * The registry-based discovery module reads `~/.tinker/acp/registry.json`
 * and shells out to `which`/`where` to check binary availability. In tests
 * we stub `child_process.execFile` and `fs/promises` so no real binaries or
 * files are needed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
   vi.mock requires loose typing for the factory callback. */

const execFileMock = vi.fn();
const readFileMock = vi.fn();
const writeFileMock = vi.fn();
const mkdirMock = vi.fn();
const accessMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => execFileMock(...args),
}));

vi.mock('node:fs/promises', () => ({
  readFile: (...args: any[]) => readFileMock(...args),
  writeFile: (...args: any[]) => writeFileMock(...args),
  mkdir: (...args: any[]) => mkdirMock(...args),
  access: (...args: any[]) => accessMock(...args),
}));

/* eslint-enable @typescript-eslint/no-explicit-any */

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

const REGISTRY_PATH = '/tmp/test-tinker-registry.json';

const makeTestRegistry = (agents: object[]) =>
  JSON.stringify({ version: '1.0.0', agents, extensions: [] });

beforeEach(() => {
  vi.clearAllMocks();
  mkdirMock.mockResolvedValue(undefined);
  writeFileMock.mockResolvedValue(undefined);
  accessMock.mockRejectedValue(new Error('no file'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discoverAcpConnectors (registry-based)', () => {
  it('seeds default agents when registry file does not exist', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'));

    // All seed binaries will be "not found"
    setupExecFile({
      'which goose': { error: true },
      'where goose': { error: true },
      'which claude': { error: true },
      'where claude': { error: true },
      'which codex': { error: true },
      'where codex': { error: true },
      'which opencode': { error: true },
      'where opencode': { error: true },
    });

    const result: AcpDiscoveryResult = await discoverAcpConnectors({
      registryPath: REGISTRY_PATH,
    });

    // Should have seeded with default agents (goose, claude-code, codex, opencode)
    expect(result.agents.length).toBeGreaterThanOrEqual(4);
    const ids = result.agents.map((a) => a.id);
    expect(ids).toContain('goose');
    expect(ids).toContain('claude-code');
    expect(ids).toContain('codex');
    expect(ids).toContain('opencode');

    // Should have written the seed registry
    expect(writeFileMock).toHaveBeenCalledWith(
      REGISTRY_PATH,
      expect.stringContaining('"version"'),
      'utf-8',
    );
  });

  it('reports agents as not-installed when binaries are not found', async () => {
    readFileMock.mockResolvedValue(
      makeTestRegistry([
        {
          id: 'my-agent',
          name: 'My Agent',
          version: '2.0.0',
          description: 'A custom agent',
          authors: ['Me'],
          license: 'MIT',
          distribution: {
            binary: {
              'linux-x86_64': { archive: '', cmd: 'my-agent', args: ['acp'] },
            },
          },
        },
      ]),
    );

    setupExecFile({
      'which my-agent': { error: true },
      'where my-agent': { error: true },
    });

    const result = await discoverAcpConnectors({ registryPath: REGISTRY_PATH });

    const agent = result.agents.find((a) => a.id === 'my-agent');
    expect(agent).toBeDefined();
    expect(agent?.status).toBe('not-installed');
    expect(agent?.message).toContain('not found');
    expect(agent?.cmd).toBe('my-agent');
  });

  it('reports agents as detected when binaries are found', async () => {
    readFileMock.mockResolvedValue(
      makeTestRegistry([
        {
          id: 'test-agent',
          name: 'Test Agent',
          version: '1.0.0',
          description: 'Test',
          authors: ['Test'],
          license: 'MIT',
          distribution: {
            binary: {
              'linux-x86_64': { archive: '', cmd: 'test-agent', args: ['serve'] },
            },
          },
        },
      ]),
    );

    setupExecFile({
      'which test-agent': { stdout: '/usr/local/bin/test-agent\n' },
    });

    const result = await discoverAcpConnectors({ registryPath: REGISTRY_PATH });

    const agent = result.agents.find((a) => a.id === 'test-agent');
    expect(agent?.status).toBe('detected');
    expect(agent?.message).toBeNull();
    expect(agent?.cmd).toBe('test-agent');
    expect(agent?.args).toEqual(['serve']);
  });

  it('reports agents as unavailable when no platform binary is configured', async () => {
    readFileMock.mockResolvedValue(
      makeTestRegistry([
        {
          id: 'mac-only',
          name: 'Mac Only Agent',
          version: '1.0.0',
          description: 'Only works on mac',
          authors: ['Apple Fan'],
          license: 'MIT',
          distribution: {
            binary: {
              'darwin-aarch64': { archive: '', cmd: 'mac-agent', args: [] },
            },
          },
        },
      ]),
    );

    const result = await discoverAcpConnectors({ registryPath: REGISTRY_PATH });

    const agent = result.agents.find((a) => a.id === 'mac-only');
    // On linux-x86_64 test environment, no binary configured for this platform
    if (result.platformKey === 'linux-x86_64') {
      expect(agent?.status).toBe('unavailable');
      expect(agent?.message).toContain('No binary configured');
    }
  });

  it('returns registry path in discovery result', async () => {
    readFileMock.mockResolvedValue(makeTestRegistry([]));

    const result = await discoverAcpConnectors({ registryPath: REGISTRY_PATH });

    expect(result.registryPath).toBe(REGISTRY_PATH);
  });

  it('returns platform key in discovery result', async () => {
    readFileMock.mockResolvedValue(makeTestRegistry([]));

    const result = await discoverAcpConnectors({ registryPath: REGISTRY_PATH });

    expect(result.platformKey).not.toBeNull();
    expect(result.platformKey).toMatch(/^(darwin|linux|windows)-(aarch64|x86_64)$/);
  });

  it('dynamically discovers any registered agent without hardcoded lists', async () => {
    readFileMock.mockResolvedValue(
      makeTestRegistry([
        {
          id: 'custom-ai',
          name: 'Custom AI',
          version: '3.0.0',
          description: 'A completely custom agent',
          authors: ['Custom Corp'],
          license: 'Apache-2.0',
          distribution: {
            binary: {
              'linux-x86_64': { archive: '', cmd: '/opt/custom-ai/bin/agent', args: ['--mode', 'acp'] },
            },
          },
        },
      ]),
    );

    // Absolute path check via fs.access
    accessMock.mockResolvedValue(undefined);

    const result = await discoverAcpConnectors({ registryPath: REGISTRY_PATH });

    const agent = result.agents.find((a) => a.id === 'custom-ai');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Custom AI');
    expect(agent?.status).toBe('detected');
    expect(agent?.cmd).toBe('/opt/custom-ai/bin/agent');
    expect(agent?.args).toEqual(['--mode', 'acp']);
  });
});
