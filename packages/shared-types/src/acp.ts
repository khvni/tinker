/**
 * ACP (Agent Client Protocol) types for agent-agnostic spawning.
 *
 * Tinker uses a registry-based discovery model (mirroring Devin Desktop's
 * `~/.windsurf/acp/registry.json`). Any binary that speaks JSON-RPC over
 * stdio can be registered in `~/.tinker/acp/registry.json`.
 *
 * There are no hardcoded agent lists — the registry is the single source
 * of truth. These types model the discovery results and UI contract.
 */

// ---------------------------------------------------------------------------
// Connector status
// ---------------------------------------------------------------------------

/**
 * Lifecycle states a connector can be in.
 *
 * - `not-installed`: binary not found on the system.
 * - `detected`:      binary found and accessible.
 * - `configured`:    agent is wired and ready to use.
 * - `unavailable`:   no platform binary configured or unsupported platform.
 * - `errored`:       agent was configured but failed at runtime.
 */
export const ACP_CONNECTOR_STATUSES = [
  'not-installed',
  'detected',
  'configured',
  'unavailable',
  'errored',
] as const;

export type AcpConnectorStatus = (typeof ACP_CONNECTOR_STATUSES)[number];

// ---------------------------------------------------------------------------
// Connector state (runtime) — populated dynamically from registry
// ---------------------------------------------------------------------------

/** Runtime state for a single ACP agent, populated from registry discovery. */
export type AcpConnectorState = {
  /** Agent identifier from registry.json. */
  readonly id: string;
  /** Human-readable agent name from registry.json. */
  readonly name: string;
  /** Short description from registry.json. */
  readonly description: string;
  /** Current discovery status. */
  readonly status: AcpConnectorStatus;
  /** Human-readable error or recovery hint shown in Settings. */
  readonly message: string | null;
  /** Agent version from registry.json. */
  readonly version: string;
  /** Agent authors from registry.json. */
  readonly authors: ReadonlyArray<string>;
  /** Icon URL (optional). */
  readonly icon?: string;
  /** Resolved command for current platform (null if unavailable). */
  readonly cmd: string | null;
  /** Resolved args for current platform. */
  readonly args: ReadonlyArray<string>;
};

// ---------------------------------------------------------------------------
// Discovery result
// ---------------------------------------------------------------------------

/** Platform key from the registry spec (os-arch). */
export type AcpPlatformKey =
  | 'darwin-aarch64'
  | 'darwin-x86_64'
  | 'linux-aarch64'
  | 'linux-x86_64'
  | 'windows-aarch64'
  | 'windows-x86_64';

/** Full discovery result returned by host-service. */
export type AcpDiscoveryResult = {
  /** Discovered agents with their current status. */
  readonly agents: ReadonlyArray<AcpConnectorState>;
  /** Current platform key (null if unsupported). */
  readonly platformKey: AcpPlatformKey | null;
  /** Path to the registry.json file. */
  readonly registryPath: string;
};

// ---------------------------------------------------------------------------
// Goose connection (preserved for backward compat with host-service)
// ---------------------------------------------------------------------------

/**
 * Connection info for a running Goose ACP server.
 * The host-service spawns Goose and exposes these fields.
 */
export type GooseConnection = {
  /** ACP HTTP endpoint, e.g. `http://127.0.0.1:3284/acp`. */
  readonly baseUrl: string;
  /** ACP session id assigned by Goose after `session/new`. */
  readonly sessionId: string | null;
  /** PID of the spawned Goose process (for lifecycle management). */
  readonly pid: number | undefined;
};

// ---------------------------------------------------------------------------
// Delegated-agent event (bridge → UI)
// ---------------------------------------------------------------------------

/**
 * Describes a delegation event emitted by Goose when it routes a
 * sub-task to an ACP coding agent. Rendered as a collapsed disclosure
 * in the Chat pane.
 */
export type DelegatedAgentEvent = {
  /** Unique id for this delegation (maps to the ACP tool-call id). */
  readonly id: string;
  /** Which coding agent handled the delegation. */
  readonly agent: string;
  /** One-line summary of what was delegated. */
  readonly title: string;
  /** Current phase: pending → running → completed | errored. */
  readonly status: 'pending' | 'running' | 'completed' | 'errored';
  /** Content chunks produced by the delegated agent. */
  readonly content: ReadonlyArray<{ readonly type: string; readonly text: string }>;
};
