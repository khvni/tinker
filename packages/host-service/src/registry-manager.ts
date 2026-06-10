/**
 * ACP Agent Registry Manager.
 *
 * Reads and writes `~/.tinker/acp/registry.json`, following the same schema
 * as Devin Desktop's local ACP registry (`~/.windsurf/acp/registry.json`).
 *
 * Any binary that speaks JSON-RPC over stdio (ACP protocol) can be registered.
 * The registry is the single source of truth for agent availability — no
 * hardcoded binary lists, no PATH scanning.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Registry schema types (mirrors Devin Desktop / ACP registry spec)
// ---------------------------------------------------------------------------

/** Platform keys follow the Devin Desktop convention: `{os}-{arch}`. */
export type AcpPlatformKey =
  | 'darwin-aarch64'
  | 'darwin-x86_64'
  | 'linux-aarch64'
  | 'linux-x86_64'
  | 'windows-aarch64'
  | 'windows-x86_64';

/** Per-platform binary distribution entry. */
export type AcpBinaryDistribution = {
  /** URL to a downloadable archive (empty string if pre-installed). */
  readonly archive: string;
  /** Command to execute (absolute path or PATH-resolvable name). */
  readonly cmd: string;
  /** Arguments passed to the binary on launch. */
  readonly args: ReadonlyArray<string>;
};

/** Agent distribution configuration. */
export type AcpAgentDistribution = {
  readonly binary: Partial<Record<AcpPlatformKey, AcpBinaryDistribution>>;
};

/** Environment variable configuration for an agent. */
export type AcpAgentEnv = Record<string, string>;

/** Auth delegation config — each agent handles its own auth. */
export type AcpAuthDelegation = {
  /** Whether the agent manages its own authentication (always true for ACP). */
  readonly selfManaged: boolean;
  /** Optional login command hint shown to users. */
  readonly loginHint: string | null;
};

/** A single agent entry in the registry. */
export type AcpRegistryAgent = {
  /** Unique agent identifier (e.g. 'claude-code', 'opencode'). */
  readonly id: string;
  /** Human-readable agent name. */
  readonly name: string;
  /** Semantic version of the agent. */
  readonly version: string;
  /** Short description of the agent. */
  readonly description: string;
  /** Repository URL (optional). */
  readonly repository?: string;
  /** Website URL (optional). */
  readonly website?: string;
  /** Agent authors. */
  readonly authors: ReadonlyArray<string>;
  /** License identifier (e.g. 'MIT', 'proprietary'). */
  readonly license: string;
  /** Icon URL for the agent (optional). */
  readonly icon?: string;
  /** Per-platform binary distribution. */
  readonly distribution: AcpAgentDistribution;
  /** Environment variables to pass when spawning the agent (optional). */
  readonly env?: AcpAgentEnv;
  /** Auth delegation configuration (optional; defaults to self-managed). */
  readonly authDelegation?: AcpAuthDelegation;
};

/** Top-level registry.json structure. */
export type AcpRegistry = {
  readonly version: string;
  readonly agents: ReadonlyArray<AcpRegistryAgent>;
  readonly extensions: ReadonlyArray<unknown>;
};

// ---------------------------------------------------------------------------
// Default registry path
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY_DIR = join(homedir(), '.tinker', 'acp');
const DEFAULT_REGISTRY_PATH = join(DEFAULT_REGISTRY_DIR, 'registry.json');

// ---------------------------------------------------------------------------
// Platform key resolution
// ---------------------------------------------------------------------------

const resolveCurrentPlatformKey = (): AcpPlatformKey | null => {
  const plat = process.platform;
  const arch = process.arch;

  let os: string;
  switch (plat) {
    case 'darwin':
      os = 'darwin';
      break;
    case 'linux':
      os = 'linux';
      break;
    case 'win32':
      os = 'windows';
      break;
    default:
      return null;
  }

  let cpu: string;
  switch (arch) {
    case 'arm64':
      cpu = 'aarch64';
      break;
    case 'x64':
      cpu = 'x86_64';
      break;
    default:
      return null;
  }

  return `${os}-${cpu}` as AcpPlatformKey;
};

// ---------------------------------------------------------------------------
// Seed registry (default entries for currently supported agents)
// ---------------------------------------------------------------------------

const SEED_AGENTS: ReadonlyArray<AcpRegistryAgent> = [
  {
    id: 'goose',
    name: 'Goose',
    version: '1.0.0',
    description: 'AI coding agent runtime by Block. Tinker\'s primary ACP runtime.',
    repository: 'https://github.com/block/goose',
    website: 'https://block.github.io/goose/',
    authors: ['Block'],
    license: 'Apache-2.0',
    distribution: {
      binary: {
        'darwin-aarch64': { archive: '', cmd: 'goose', args: ['acp'] },
        'darwin-x86_64': { archive: '', cmd: 'goose', args: ['acp'] },
        'linux-aarch64': { archive: '', cmd: 'goose', args: ['acp'] },
        'linux-x86_64': { archive: '', cmd: 'goose', args: ['acp'] },
        'windows-aarch64': { archive: '', cmd: 'goose.exe', args: ['acp'] },
        'windows-x86_64': { archive: '', cmd: 'goose.exe', args: ['acp'] },
      },
    },
    env: {},
    authDelegation: { selfManaged: true, loginHint: null },
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    version: '1.0.0',
    description: 'Anthropic\'s headless coding agent via ACP.',
    repository: 'https://github.com/anthropics/claude-code',
    website: 'https://docs.anthropic.com/en/docs/claude-code',
    authors: ['Anthropic'],
    license: 'proprietary',
    distribution: {
      binary: {
        'darwin-aarch64': { archive: '', cmd: 'claude', args: ['acp'] },
        'darwin-x86_64': { archive: '', cmd: 'claude', args: ['acp'] },
        'linux-aarch64': { archive: '', cmd: 'claude', args: ['acp'] },
        'linux-x86_64': { archive: '', cmd: 'claude', args: ['acp'] },
        'windows-aarch64': { archive: '', cmd: 'claude.exe', args: ['acp'] },
        'windows-x86_64': { archive: '', cmd: 'claude.exe', args: ['acp'] },
      },
    },
    env: {},
    authDelegation: { selfManaged: true, loginHint: '/login' },
  },
  {
    id: 'codex',
    name: 'Codex',
    version: '1.0.0',
    description: 'OpenAI\'s headless coding agent via ACP.',
    repository: 'https://github.com/openai/codex',
    website: 'https://github.com/openai/codex',
    authors: ['OpenAI'],
    license: 'Apache-2.0',
    distribution: {
      binary: {
        'darwin-aarch64': { archive: '', cmd: 'codex', args: ['acp'] },
        'darwin-x86_64': { archive: '', cmd: 'codex', args: ['acp'] },
        'linux-aarch64': { archive: '', cmd: 'codex', args: ['acp'] },
        'linux-x86_64': { archive: '', cmd: 'codex', args: ['acp'] },
        'windows-aarch64': { archive: '', cmd: 'codex.exe', args: ['acp'] },
        'windows-x86_64': { archive: '', cmd: 'codex.exe', args: ['acp'] },
      },
    },
    env: {},
    authDelegation: { selfManaged: true, loginHint: null },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    version: '1.0.0',
    description: 'Open-source coding agent by Anomaly.',
    repository: 'https://github.com/anomalyco/opencode',
    website: 'https://opencode.ai',
    authors: ['Anomaly'],
    license: 'MIT',
    distribution: {
      binary: {
        'darwin-aarch64': { archive: '', cmd: 'opencode', args: ['acp'] },
        'darwin-x86_64': { archive: '', cmd: 'opencode', args: ['acp'] },
        'linux-aarch64': { archive: '', cmd: 'opencode', args: ['acp'] },
        'linux-x86_64': { archive: '', cmd: 'opencode', args: ['acp'] },
        'windows-aarch64': { archive: '', cmd: 'opencode.exe', args: ['acp'] },
        'windows-x86_64': { archive: '', cmd: 'opencode.exe', args: ['acp'] },
      },
    },
    env: {},
    authDelegation: { selfManaged: true, loginHint: '/login' },
  },
];

// ---------------------------------------------------------------------------
// RegistryManager
// ---------------------------------------------------------------------------

export type RegistryManagerOptions = {
  /** Override the registry file path. Useful for tests. */
  registryPath?: string;
};

export type RegistryManager = {
  /** Read the current registry. Creates the seed registry if none exists. */
  read(): Promise<AcpRegistry>;
  /** Write a full registry to disk. */
  write(registry: AcpRegistry): Promise<void>;
  /** Add an agent to the registry. Replaces any existing entry with the same id. */
  addAgent(agent: AcpRegistryAgent): Promise<AcpRegistry>;
  /** Remove an agent by id. Returns the updated registry. */
  removeAgent(agentId: string): Promise<AcpRegistry>;
  /** Get the registry file path. */
  getRegistryPath(): string;
  /** Get the current platform key (null if unsupported). */
  getCurrentPlatformKey(): AcpPlatformKey | null;
  /** Get seed agents (for initializing fresh registries). */
  getSeedAgents(): ReadonlyArray<AcpRegistryAgent>;
};

const createEmptyRegistry = (): AcpRegistry => ({
  version: '1.0.0',
  agents: [...SEED_AGENTS],
  extensions: [],
});

const isValidRegistry = (data: unknown): data is AcpRegistry => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj['version'] !== 'string') return false;
  if (!Array.isArray(obj['agents'])) return false;
  return true;
};

export const createRegistryManager = (options: RegistryManagerOptions = {}): RegistryManager => {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY_PATH;

  const read = async (): Promise<AcpRegistry> => {
    try {
      const content = await readFile(registryPath, 'utf-8');
      const parsed: unknown = JSON.parse(content);
      if (!isValidRegistry(parsed)) {
        return createEmptyRegistry();
      }
      return parsed;
    } catch {
      // File doesn't exist or is unreadable — seed with defaults
      const seed = createEmptyRegistry();
      await write(seed);
      return seed;
    }
  };

  const write = async (registry: AcpRegistry): Promise<void> => {
    const dir = dirname(registryPath);
    await mkdir(dir, { recursive: true });
    const content = JSON.stringify(registry, null, 2) + '\n';
    await writeFile(registryPath, content, 'utf-8');
  };

  const addAgent = async (agent: AcpRegistryAgent): Promise<AcpRegistry> => {
    const current = await read();
    const filtered = current.agents.filter((a) => a.id !== agent.id);
    const updated: AcpRegistry = {
      ...current,
      agents: [...filtered, agent],
    };
    await write(updated);
    return updated;
  };

  const removeAgent = async (agentId: string): Promise<AcpRegistry> => {
    const current = await read();
    const updated: AcpRegistry = {
      ...current,
      agents: current.agents.filter((a) => a.id !== agentId),
    };
    await write(updated);
    return updated;
  };

  return {
    read,
    write,
    addAgent,
    removeAgent,
    getRegistryPath: () => registryPath,
    getCurrentPlatformKey: resolveCurrentPlatformKey,
    getSeedAgents: () => SEED_AGENTS,
  };
};
