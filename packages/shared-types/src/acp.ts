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
// ACP stdio connection types (Phase 2–4)
// ---------------------------------------------------------------------------

/**
 * ACP JSON-RPC message primitives.
 * Per spec: messages are newline-delimited JSON-RPC 2.0 over stdin/stdout.
 */
export type AcpJsonRpcRequest = {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly id: number;
  readonly params?: Record<string, unknown>;
};

export type AcpJsonRpcResponse = {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
};

export type AcpJsonRpcNotification = {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Record<string, unknown>;
};

export type AcpJsonRpcMessage = AcpJsonRpcRequest | AcpJsonRpcResponse | AcpJsonRpcNotification;

/** Capabilities the client advertises during `initialize`. */
export type AcpClientCapabilities = {
  readonly fs?: {
    readonly readTextFile?: boolean;
    readonly writeTextFile?: boolean;
  };
  readonly terminal?: boolean;
};

/** Capabilities the agent advertises in `initialize` response. */
export type AcpAgentCapabilities = {
  readonly loadSession?: boolean;
  readonly promptCapabilities?: {
    readonly image?: boolean;
    readonly audio?: boolean;
    readonly embeddedContext?: boolean;
  };
  readonly mcpCapabilities?: {
    readonly http?: boolean;
    readonly sse?: boolean;
  };
  readonly sessionCapabilities?: Record<string, unknown>;
  readonly auth?: Record<string, unknown>;
};

export type AcpInitializeResult = {
  readonly protocolVersion: number;
  readonly agentCapabilities?: AcpAgentCapabilities;
  readonly agentInfo?: { readonly name: string; readonly title?: string; readonly version: string };
  readonly authMethods?: ReadonlyArray<{ readonly id: string; readonly type: string }>;
};

/** Result from `session/new`. */
export type AcpSessionNewResult = {
  readonly sessionId: string;
};

/** ACP tool-call status lifecycle. */
export const ACP_TOOL_CALL_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'error',
  'cancelled',
] as const;

export type AcpToolCallStatus = (typeof ACP_TOOL_CALL_STATUSES)[number];

/** ACP tool-call kind per spec. */
export type AcpToolCallKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'other';

/** Tool-call notification from `session/update`. */
export type AcpToolCall = {
  readonly toolCallId: string;
  readonly title: string;
  readonly kind?: AcpToolCallKind;
  readonly status: AcpToolCallStatus;
  readonly content?: ReadonlyArray<AcpToolCallContent>;
  readonly locations?: ReadonlyArray<{ readonly path: string; readonly line?: number }>;
  readonly input?: unknown;
  readonly output?: unknown;
};

/** Tool-call update notification fields. */
export type AcpToolCallUpdate = {
  readonly toolCallId: string;
  readonly status?: AcpToolCallStatus;
  readonly title?: string;
  readonly content?: ReadonlyArray<AcpToolCallContent>;
  readonly locations?: ReadonlyArray<{ readonly path: string; readonly line?: number }>;
  readonly input?: unknown;
  readonly output?: unknown;
};

export type AcpToolCallContent = {
  readonly type: 'content';
  readonly content: { readonly type: string; readonly text: string };
};

/** Permission request from agent → client (`session/request_permission`). */
export type AcpPermissionRequest = {
  readonly sessionId: string;
  readonly toolCall: { readonly toolCallId: string };
  readonly options: ReadonlyArray<AcpPermissionOption>;
};

export type AcpPermissionOption = {
  readonly optionId: string;
  readonly name: string;
  readonly kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
};

export type AcpPermissionOutcome =
  | { readonly outcome: 'cancelled' }
  | { readonly outcome: 'selected'; readonly optionId: string };

/** Session update notification union from `session/update`. */
export type AcpSessionUpdate =
  | { readonly sessionUpdate: 'agent_message_chunk'; readonly content: { readonly type: string; readonly text: string } }
  | { readonly sessionUpdate: 'agent_thought_chunk'; readonly content: { readonly type: string; readonly text: string } }
  | ({ readonly sessionUpdate: 'tool_call' } & Omit<AcpToolCall, never>)
  | ({ readonly sessionUpdate: 'tool_call_update' } & Omit<AcpToolCallUpdate, never>)
  | { readonly sessionUpdate: 'plan'; readonly plan: unknown };

/** Stop reason in `session/prompt` response. */
export type AcpStopReason = 'end_turn' | 'cancelled' | 'tool_use' | 'max_tokens' | 'error';

/** stdio spawn configuration used by the Rust coordinator. */
export type AcpStdioSpawnConfig = {
  readonly cmd: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd?: string;
  readonly env?: Record<string, string>;
};

/** Handle returned after spawning an ACP agent via stdio. */
export type AcpStdioHandle = {
  readonly pid: number;
  readonly agentId: string;
  readonly agentName: string;
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
