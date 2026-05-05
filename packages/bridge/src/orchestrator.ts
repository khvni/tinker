import type { Agent, OpencodeClient } from '@opencode-ai/sdk/v2/client';

/**
 * Hard cap on how many subagents the orchestrator can run in parallel
 * inside a single session prompt turn. Token cost grows linearly with
 * worker count; cap matches the v1 ceiling agreed for TIN-130.
 *
 * Enforced by callers that decompose work explicitly (e.g. TIN-131's
 * worker registry). Model-driven decomposition is bounded by the
 * orchestrator agent's `task` permission instead.
 */
export const MAX_PARALLEL_SUBAGENTS = 5;

/**
 * Lists subagents declared in the running OpenCode instance. A subagent
 * is any `Agent` with `mode === 'subagent'` or `mode === 'all'` — the
 * latter can be invoked both as a primary agent and as a worker.
 *
 * Used by the worker registry (TIN-131) to validate names before
 * building `SubtaskPartInput` payloads, and by the chat UI (TIN-132)
 * to render the @-mention picker.
 */
export const listSubagents = async (
  client: Pick<OpencodeClient, 'app'>,
): Promise<Agent[]> => {
  const response = await client.app.agents();
  const agents = response.data ?? [];
  return agents.filter((agent) => agent.mode === 'subagent' || agent.mode === 'all');
};
