import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRegistryManager, type AcpRegistry, type AcpRegistryAgent } from './registry-manager.js';

/* eslint-disable @typescript-eslint/no-explicit-any --
   vi.mock requires loose typing for the factory callback. */

const readFileMock = vi.fn();
const writeFileMock = vi.fn();
const mkdirMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  readFile: (...args: any[]) => readFileMock(...args),
  writeFile: (...args: any[]) => writeFileMock(...args),
  mkdir: (...args: any[]) => mkdirMock(...args),
}));

/* eslint-enable @typescript-eslint/no-explicit-any */

const TEST_PATH = '/tmp/test-registry/registry.json';

beforeEach(() => {
  vi.clearAllMocks();
  mkdirMock.mockResolvedValue(undefined);
  writeFileMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createRegistryManager', () => {
  it('returns the configured registry path', () => {
    const manager = createRegistryManager({ registryPath: TEST_PATH });
    expect(manager.getRegistryPath()).toBe(TEST_PATH);
  });

  it('returns a non-null platform key on supported systems', () => {
    const manager = createRegistryManager({ registryPath: TEST_PATH });
    const key = manager.getCurrentPlatformKey();
    expect(key).not.toBeNull();
    expect(key).toMatch(/^(darwin|linux|windows)-(aarch64|x86_64)$/);
  });

  it('exposes seed agents', () => {
    const manager = createRegistryManager({ registryPath: TEST_PATH });
    const seeds = manager.getSeedAgents();
    expect(seeds.length).toBeGreaterThanOrEqual(5);
    const ids = seeds.map((a) => a.id);
    expect(ids).toContain('goose');
    expect(ids).toContain('claude-code');
    expect(ids).toContain('codex');
    expect(ids).toContain('opencode');
    expect(ids).toContain('monkeybot');
  });

  describe('read', () => {
    it('seeds with defaults when file does not exist', async () => {
      readFileMock.mockRejectedValue(new Error('ENOENT'));

      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const registry = await manager.read();

      expect(registry.version).toBe('1.0.0');
      expect(registry.agents.length).toBeGreaterThanOrEqual(4);
      expect(writeFileMock).toHaveBeenCalledWith(
        TEST_PATH,
        expect.stringContaining('"version"'),
        'utf-8',
      );
    });

    it('reads an existing registry from disk', async () => {
      const existing: AcpRegistry = {
        version: '1.0.0',
        agents: [
          {
            id: 'custom',
            name: 'Custom',
            version: '1.0.0',
            description: 'Custom agent',
            authors: ['Tester'],
            license: 'MIT',
            distribution: { binary: {} },
          },
        ],
        extensions: [],
      };
      readFileMock.mockResolvedValue(JSON.stringify(existing));

      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const registry = await manager.read();

      expect(registry.agents).toHaveLength(1);
      expect(registry.agents[0]?.id).toBe('custom');
    });

    it('resets to seed if file contains invalid JSON', async () => {
      readFileMock.mockResolvedValue('not valid json{{{');

      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const registry = await manager.read();

      expect(registry.version).toBe('1.0.0');
      expect(registry.agents.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('write', () => {
    it('creates directory and writes JSON', async () => {
      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const registry: AcpRegistry = { version: '1.0.0', agents: [], extensions: [] };

      await manager.write(registry);

      expect(mkdirMock).toHaveBeenCalledWith('/tmp/test-registry', { recursive: true });
      expect(writeFileMock).toHaveBeenCalledWith(
        TEST_PATH,
        expect.stringContaining('"version": "1.0.0"'),
        'utf-8',
      );
    });
  });

  describe('addAgent', () => {
    it('adds a new agent to the registry', async () => {
      readFileMock.mockResolvedValue(
        JSON.stringify({ version: '1.0.0', agents: [], extensions: [] }),
      );

      const newAgent: AcpRegistryAgent = {
        id: 'new-agent',
        name: 'New Agent',
        version: '1.0.0',
        description: 'Brand new',
        authors: ['Builder'],
        license: 'MIT',
        distribution: {
          binary: {
            'linux-x86_64': { archive: '', cmd: 'new-agent', args: ['acp'] },
          },
        },
      };

      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const result = await manager.addAgent(newAgent);

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0]?.id).toBe('new-agent');
    });

    it('replaces existing agent with same id', async () => {
      readFileMock.mockResolvedValue(
        JSON.stringify({
          version: '1.0.0',
          agents: [{ id: 'existing', name: 'Old', version: '0.1.0', description: 'Old', authors: ['A'], license: 'MIT', distribution: { binary: {} } }],
          extensions: [],
        }),
      );

      const updated: AcpRegistryAgent = {
        id: 'existing',
        name: 'Updated',
        version: '2.0.0',
        description: 'Updated agent',
        authors: ['B'],
        license: 'MIT',
        distribution: { binary: {} },
      };

      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const result = await manager.addAgent(updated);

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0]?.name).toBe('Updated');
      expect(result.agents[0]?.version).toBe('2.0.0');
    });
  });

  describe('removeAgent', () => {
    it('removes an agent by id', async () => {
      readFileMock.mockResolvedValue(
        JSON.stringify({
          version: '1.0.0',
          agents: [
            { id: 'keep', name: 'Keep', version: '1.0.0', description: 'K', authors: ['A'], license: 'MIT', distribution: { binary: {} } },
            { id: 'remove', name: 'Remove', version: '1.0.0', description: 'R', authors: ['A'], license: 'MIT', distribution: { binary: {} } },
          ],
          extensions: [],
        }),
      );

      const manager = createRegistryManager({ registryPath: TEST_PATH });
      const result = await manager.removeAgent('remove');

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0]?.id).toBe('keep');
    });
  });
});
