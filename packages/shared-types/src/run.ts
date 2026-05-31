/**
 * Goose run types — the normalized surface between host-service and the
 * renderer. Chat and Runs panes consume these; the host-service produces
 * them by translating from whatever agent backend is active (OpenCode today,
 * Goose tomorrow). Renderer code never imports `@opencode-ai/sdk` directly.
 */

export const RUN_STATUSES = ['active', 'completed', 'failed', 'aborted', 'waiting-for-approval'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/**
 * Normalized run event union. Every field that the Chat UI needs to render
 * streaming output, tool disclosures, approval gates, and subagent activity
 * is expressed here. Host-service translates backend-specific events into
 * this shape before streaming them to the renderer via SSE.
 *
 * Field naming matches existing Tinker conventions: `partID`, `providerID`,
 * `modelID` (capital D) for consistency with `TinkerStreamEvent` and `Block`.
 */
export type RunEvent =
  | { type: 'token'; partID: string; text: string }
  | { type: 'reasoning'; partID: string; text: string }
  | { type: 'tool_call'; partID: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; partID: string; name: string; output: string }
  | { type: 'tool_error'; partID: string; name: string; message: string }
  | {
      type: 'approval_request';
      partID: string;
      tool: string;
      input: Record<string, unknown>;
      description: string;
    }
  | {
      type: 'subagent';
      partID: string;
      agent: string;
      description: string;
      prompt: string;
      providerID: string | null;
      modelID: string | null;
    }
  | { type: 'agent_invoked'; partID: string; name: string }
  | {
      type: 'delegate';
      partID: string;
      agent: string;
      protocol: string;
      description: string;
    }
  | {
      type: 'context_usage';
      providerID: string | null;
      modelID: string | null;
      tokens: RunContextTokens;
    }
  | { type: 'artifact'; path: string }
  | { type: 'error'; message: string }
  | { type: 'status_changed'; status: RunStatus }
  | { type: 'done' };

export type RunContextTokens = {
  total?: number | undefined;
  input: number;
  output: number;
  reasoning: number;
};

/** Persisted run record returned by `GET /runs.list` and `GET /runs.get`. */
export type Run = {
  id: string;
  title: string;
  status: RunStatus;
  projectPath: string | null;
  createdAt: string;
  updatedAt: string;
  modelID: string | null;
  providerID: string | null;
};

export type CreateRunRequest = {
  title?: string | undefined;
  projectPath?: string | null | undefined;
  modelID?: string | undefined;
  providerID?: string | undefined;
};

export type PromptRunRequest = {
  runId: string;
  text: string;
  agent?: string | undefined;
  variant?: string | undefined;
  model?: {
    providerID: string;
    modelID: string;
  } | undefined;
};

export type AbortRunRequest = {
  runId: string;
};

export type ApprovalResponse = {
  runId: string;
  partID: string;
  approved: boolean;
};
