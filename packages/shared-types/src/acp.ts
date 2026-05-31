/**
 * ACP (Agent Client Protocol) connector types for coding-agent
 * integration through Goose.
 *
 * Tinker talks to Goose as the primary chat runtime via ACP-over-HTTP.
 * Goose can optionally delegate tasks to external coding agents
 * (Claude Code, Codex, OpenCode, etc.) that speak ACP over stdio.
 * These types model the connector discovery, status, and configuration
 * surface that the Settings UI and host-service use.
 */

// ---------------------------------------------------------------------------
// Connector identity
// ---------------------------------------------------------------------------

/** Well-known ACP coding-agent connector identifiers. */
export const ACP_CONNECTOR_IDS = [
  'claude-code',
  'codex',
  'opencode',
] as const;

export type AcpConnectorId = (typeof ACP_CONNECTOR_IDS)[number];

// ---------------------------------------------------------------------------
// Connector status
// ---------------------------------------------------------------------------

/**
 * Lifecycle states a connector can be in.
 *
 * - `not-installed`: binary not found on the system.
 * - `detected`:      binary found but not yet configured in Goose.
 * - `configured`:    connector is wired into Goose and ready to use.
 * - `unavailable`:   Goose itself is not installed or not running.
 * - `errored`:       connector was configured but failed at runtime.
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
// Connector metadata
// ---------------------------------------------------------------------------

/** Human-readable metadata for a connector, used in Settings UI. */
export type AcpConnectorMeta = {
  readonly id: AcpConnectorId;
  readonly label: string;
  readonly description: string;
  /** Shell command or package name a user would install. */
  readonly installHint: string;
  /** Documentation URL for setup instructions. */
  readonly docsUrl: string;
};

export const ACP_CONNECTOR_META: ReadonlyArray<AcpConnectorMeta> = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    description: "Anthropic's headless coding agent via ACP.",
    installHint: 'npm install -g @anthropic-ai/claude-code',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  },
  {
    id: 'codex',
    label: 'Codex',
    description: "OpenAI's headless coding agent via ACP.",
    installHint: 'npm install -g @openai/codex',
    docsUrl: 'https://github.com/openai/codex',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    description: "Open-source coding agent, formerly Tinker's primary runtime.",
    installHint: 'npm install -g opencode',
    docsUrl: 'https://opencode.ai/docs',
  },
];

// ---------------------------------------------------------------------------
// Connector state (runtime)
// ---------------------------------------------------------------------------

/** Runtime state for a single ACP connector. */
export type AcpConnectorState = {
  readonly id: AcpConnectorId;
  readonly status: AcpConnectorStatus;
  /** Human-readable error or recovery hint shown in Settings. */
  readonly message: string | null;
};

// ---------------------------------------------------------------------------
// Goose connection
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
