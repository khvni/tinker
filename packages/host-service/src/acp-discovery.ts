/**
 * ACP coding-agent discovery — registry-based.
 *
 * Replaces the former hardcoded CONNECTOR_BINARIES list with dynamic
 * lookup from `~/.tinker/acp/registry.json`. Any binary that speaks
 * JSON-RPC over stdio (ACP) can be registered; discovery enumerates
 * what's in the registry and validates binary accessibility.
 *
 * The registry format mirrors Devin Desktop's ACP registry spec
 * (`~/.windsurf/acp/registry.json`).
 */

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import {
  createRegistryManager,
  type AcpPlatformKey,
  type AcpRegistryAgent,
  type RegistryManager,
  type RegistryManagerOptions,
} from './registry-manager.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AcpConnectorStatus =
  | 'not-installed'
  | 'detected'
  | 'configured'
  | 'unavailable'
  | 'errored';

export type AcpConnectorState = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: AcpConnectorStatus;
  readonly message: string | null;
  readonly version: string;
  readonly authors: ReadonlyArray<string>;
  readonly icon?: string;
  readonly cmd: string | null;
  readonly args: ReadonlyArray<string>;
};

export type AcpDiscoveryResult = {
  readonly agents: ReadonlyArray<AcpConnectorState>;
  readonly platformKey: AcpPlatformKey | null;
  readonly registryPath: string;
};

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

const execAsync = (
  command: string,
  args: ReadonlyArray<string>,
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(command, args as string[], { timeout: 5_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const which = async (binary: string): Promise<boolean> => {
  try {
    await execAsync('which', [binary]);
    return true;
  } catch {
    try {
      await execAsync('where', [binary]);
      return true;
    } catch {
      return false;
    }
  }
};

const isAccessible = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolve whether a binary command is available on the system.
 * Checks absolute paths directly, otherwise uses which/where.
 */
const isBinaryAvailable = async (cmd: string): Promise<boolean> => {
  if (cmd.startsWith('/') || cmd.startsWith('./') || cmd.includes('\\')) {
    return isAccessible(cmd);
  }
  return which(cmd);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type DiscoverAcpConnectorsOptions = RegistryManagerOptions;

/**
 * Discover available ACP agents from the registry.
 *
 * Reads `~/.tinker/acp/registry.json`, resolves the current platform's
 * binary entries, and checks whether each binary is accessible.
 * Returns enriched connector states for the UI.
 */
export const discoverAcpConnectors = async (
  options: DiscoverAcpConnectorsOptions = {},
): Promise<AcpDiscoveryResult> => {
  const registryManager: RegistryManager = createRegistryManager(options);
  const registry = await registryManager.read();
  const platformKey = registryManager.getCurrentPlatformKey();

  if (platformKey === null) {
    return {
      agents: registry.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: 'unavailable' as const,
        message: `Unsupported platform: ${process.platform}/${process.arch}`,
        version: agent.version,
        authors: agent.authors,
        ...(agent.icon !== undefined ? { icon: agent.icon } : {}),
        cmd: null,
        args: [],
      })),
      platformKey: null,
      registryPath: registryManager.getRegistryPath(),
    };
  }

  const agentChecks = registry.agents.map(
    async (agent: AcpRegistryAgent): Promise<AcpConnectorState> => {
      const platformBinary = agent.distribution.binary[platformKey];

      if (!platformBinary) {
        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          status: 'unavailable',
          message: `No binary configured for platform ${platformKey}.`,
          version: agent.version,
          authors: agent.authors,
          ...(agent.icon !== undefined ? { icon: agent.icon } : {}),
          cmd: null,
          args: [],
        };
      }

      const available = await isBinaryAvailable(platformBinary.cmd);
      if (!available) {
        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          status: 'not-installed',
          message: `Binary "${platformBinary.cmd}" not found. Install it to enable this agent.`,
          version: agent.version,
          authors: agent.authors,
          ...(agent.icon !== undefined ? { icon: agent.icon } : {}),
          cmd: platformBinary.cmd,
          args: [...platformBinary.args],
        };
      }

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: 'detected',
        message: null,
        version: agent.version,
        authors: agent.authors,
        ...(agent.icon !== undefined ? { icon: agent.icon } : {}),
        cmd: platformBinary.cmd,
        args: [...platformBinary.args],
      };
    },
  );

  const agents = await Promise.all(agentChecks);
  return {
    agents,
    platformKey,
    registryPath: registryManager.getRegistryPath(),
  };
};
