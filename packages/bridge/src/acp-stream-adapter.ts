/**
 * ACP stream adapter — maps ACP `session/update` notifications to
 * `TinkerStreamEvent`s.
 *
 * The official ACP spec uses `session/update` notifications with
 * discriminated `sessionUpdate` fields:
 *   - `tool_call`         → creates tool call
 *   - `tool_call_update`  → updates/completes tool call
 *   - `agent_message_chunk` → text token
 *   - `agent_thought_chunk` → reasoning token
 *
 * This adapter normalizes ACP-spec tool-call events into the same
 * `TinkerStreamEvent` union the renderer already consumes, so the
 * Chat pane works identically whether the agent connects via
 * HTTP/SSE (GooseClient) or stdio (AgentSideConnection).
 *
 * This is the "callTool mapping" from Phase 3.
 */

import type {
  AcpSessionUpdate,
  AcpToolCallKind,
  AcpToolCallStatus,
} from '@tinker/shared-types';
import type { TinkerStreamEvent } from './stream.js';

// ---------------------------------------------------------------------------
// Delegation detection (same heuristic as GooseClient)
// ---------------------------------------------------------------------------

const DELEGATION_PREFIXES = [
  'Claude Code:',
  'Codex:',
  'OpenCode:',
] as const;

const detectDelegation = (
  title: string,
): { agent: string; label: string } | null => {
  for (const prefix of DELEGATION_PREFIXES) {
    if (title.startsWith(prefix)) {
      return {
        agent: prefix.slice(0, -1).toLowerCase().replace(/\s+/gu, '-'),
        label: title.slice(prefix.length).trim(),
      };
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Stateful adapter
// ---------------------------------------------------------------------------

export type AcpStreamAdapter = {
  /**
   * Feed a single `session/update` notification and get back zero or
   * more `TinkerStreamEvent`s for the renderer.
   */
  map(update: AcpSessionUpdate): TinkerStreamEvent[];
  /** Advance partID counters between assistant turns. */
  advanceTurn(): void;
  /** Reset internal tracking state between sessions. */
  reset(): void;
};

export const createAcpStreamAdapter = (): AcpStreamAdapter => {
  const delegationCalls = new Map<
    string,
    { agent: string; title: string }
  >();

  const toolCallNames = new Map<string, string>();
  let msgPartCounter = 0;
  let thoughtPartCounter = 0;

  const mapToolCallStatus = (
    status: AcpToolCallStatus,
  ): 'pending' | 'running' | 'completed' | 'errored' => {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'in_progress':
        return 'running';
      case 'completed':
        return 'completed';
      case 'error':
      case 'cancelled':
        return 'errored';
    }
  };

  const mapToolCallKindToName = (
    title: string,
    kind?: AcpToolCallKind,
  ): string => {
    if (kind && kind !== 'other') return kind;
    return title;
  };

  const map = (update: AcpSessionUpdate): TinkerStreamEvent[] => {
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        return [{ type: 'token', partID: `acp-msg-${String(msgPartCounter)}`, text: update.content.text }];
      }

      case 'agent_thought_chunk': {
        return [{ type: 'reasoning', partID: `acp-thought-${String(thoughtPartCounter)}`, text: update.content.text }];
      }

      case 'tool_call': {
        const { toolCallId, title, status, kind, content, locations } = update;

        const delegation = detectDelegation(title);
        if (delegation) {
          delegationCalls.set(toolCallId, {
            agent: delegation.agent,
            title: delegation.label || title,
          });
          return [{
            type: 'delegated_agent',
            id: toolCallId,
            agent: delegation.agent,
            title: delegation.label || title,
            status: mapToolCallStatus(status),
            content: (content ?? []).map((c) => ({
              type: c.content.type,
              text: c.content.text,
            })),
          }];
        }

        const toolName = mapToolCallKindToName(title, kind);
        toolCallNames.set(toolCallId, toolName);

        const events: TinkerStreamEvent[] = [{
          type: 'tool_call',
          partID: toolCallId,
          name: toolName,
          input: (update.input ?? {}) as Record<string, unknown>,
        }];

        if (locations) {
          for (const loc of locations) {
            events.push({ type: 'file_written', path: loc.path });
          }
        }

        return events;
      }

      case 'tool_call_update': {
        const { toolCallId, status, title, content, locations } = update;

        const existing = delegationCalls.get(toolCallId);
        if (existing) {
          const mappedStatus = status
            ? mapToolCallStatus(status)
            : 'running';

          return [{
            type: 'delegated_agent',
            id: toolCallId,
            agent: existing.agent,
            title: title ?? existing.title,
            status: mappedStatus,
            content: (content ?? []).map((c) => ({
              type: c.content.type,
              text: c.content.text,
            })),
          }];
        }

        const resolvedName = title ?? toolCallNames.get(toolCallId) ?? toolCallId;
        const events: TinkerStreamEvent[] = [];

        if (status === 'completed') {
          const output = (content ?? [])
            .map((c) => c.content.text)
            .join('\n');
          events.push({
            type: 'tool_result',
            partID: toolCallId,
            name: resolvedName,
            output,
          });
        } else if (status === 'error' || status === 'cancelled') {
          const message = (content ?? [])
            .map((c) => c.content.text)
            .join('\n');
          events.push({
            type: 'tool_error',
            partID: toolCallId,
            name: resolvedName,
            message: message || 'Tool call failed.',
          });
        }

        if (locations) {
          for (const loc of locations) {
            events.push({ type: 'file_written', path: loc.path });
          }
        }

        return events;
      }

      case 'plan':
        return [];

      default:
        return [];
    }
  };

  const advanceTurn = (): void => {
    msgPartCounter++;
    thoughtPartCounter++;
  };

  const reset = (): void => {
    delegationCalls.clear();
    toolCallNames.clear();
    msgPartCounter = 0;
    thoughtPartCounter = 0;
  };

  return { map, reset, advanceTurn };
};
