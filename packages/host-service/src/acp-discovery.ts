/**
 * ACP coding-agent connector discovery.
 *
 * Detects whether Goose is installed and which ACP coding agents
 * (Claude Code, Codex, OpenCode) are available on the host machine.
 *
 * The host-service exposes this via the health/status API so the
 * Settings UI can render connector rows with status dots.
 */

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

// ---------------------------------------------------------------------------
// Types (mirror the shapes from @tinker/shared-types/acp without
// importing the workspace package — host-service is a standalone Node
// service that must not take browser-oriented deps).
// ---------------------------------------------------------------------------

export type AcpConnectorId = 'claude-code' | 'codex' | 'opencode';

export type AcpConnectorStatus =
  | 'not-installed'
  | 'detected'
  | 'configured'
  | 'unavailable'
  | 'errored';

export type AcpConnectorState = {
  readonly id: AcpConnectorId;
  readonly status: AcpConnectorStatus;
  readonly message: string | null;
};

export type GooseStatus = {
  readonly installed: boolean;
  readonly version: string | null;
  readonly message: string | null;
};

export type AcpDiscoveryResult = {
  readonly goose: GooseStatus;
  readonly connectors: ReadonlyArray<AcpConnectorState>;
};

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

const CONNECTOR_BINARIES: ReadonlyArray<{
  id: AcpConnectorId;
  binary: string;
  label: string;
}> = [
  { id: 'claude-code', binary: 'claude', label: 'Claude Code' },
  { id: 'codex', binary: 'codex', label: 'Codex' },
  { id: 'opencode', binary: 'opencode', label: 'OpenCode' },
];

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
    // Windows fallback
    try {
      await execAsync('where', [binary]);
      return true;
    } catch {
      return false;
    }
  }
};

const getGooseVersion = async (): Promise<string | null> => {
  try {
    const { stdout } = await execAsync('goose', ['--version']);
    const version = stdout.trim();
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
};

/**
 * Check whether a Goose `profiles.yaml` exists and references the given
 * provider name. This is a lightweight heuristic — it does not parse YAML
 * but simply checks for the provider string.
 */
const isConfiguredInGoose = async (providerName: string): Promise<boolean> => {
  const configDir =
    process.env['XDG_CONFIG_HOME'] ??
    `${process.env['HOME'] ?? '/root'}/.config`;
  const profilesPath = `${configDir}/goose/profiles.yaml`;

  try {
    await access(profilesPath, constants.R_OK);
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(profilesPath, 'utf-8');
    return content.includes(providerName);
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover Goose installation and available ACP coding-agent connectors.
 *
 * Runs concurrently: checks Goose binary + each connector binary in
 * parallel. Total latency ≈ max(single check) rather than sum.
 */
export const discoverAcpConnectors = async (): Promise<AcpDiscoveryResult> => {
  const [gooseInstalled, gooseVersion] = await Promise.all([
    which('goose'),
    getGooseVersion(),
  ]);

  const goose: GooseStatus = gooseInstalled
    ? { installed: true, version: gooseVersion, message: null }
    : {
        installed: false,
        version: null,
        message:
          'Goose is not installed. Install it with: curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash',
      };

  const connectorChecks = CONNECTOR_BINARIES.map(
    async ({ id, binary, label }): Promise<AcpConnectorState> => {
      if (!gooseInstalled) {
        return {
          id,
          status: 'unavailable',
          message: `${label} requires Goose. Install Goose first.`,
        };
      }

      const found = await which(binary);
      if (!found) {
        return {
          id,
          status: 'not-installed',
          message: `${label} binary not found. Install it to enable delegation.`,
        };
      }

      const configured = await isConfiguredInGoose(id);
      if (configured) {
        return { id, status: 'configured', message: null };
      }

      return {
        id,
        status: 'detected',
        message: `${label} is installed but not configured as a Goose ACP provider.`,
      };
    },
  );

  const connectors = await Promise.all(connectorChecks);
  return { goose, connectors };
};
