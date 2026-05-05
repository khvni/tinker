import type {
  AgentPart,
  Event,
  OpencodeClient,
  Part,
  SubtaskPart,
  ToolPart,
} from '@opencode-ai/sdk/v2/client';

type ContextUsageTokens = {
  total?: number;
  input: number;
  output: number;
  reasoning: number;
};

export type TinkerStreamEvent =
  | { type: 'token'; partID: string; text: string }
  | { type: 'reasoning'; partID: string; text: string }
  | { type: 'tool_call'; partID: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; partID: string; name: string; output: string }
  | { type: 'tool_error'; partID: string; name: string; message: string }
  | {
      type: 'subtask';
      partID: string;
      agent: string;
      description: string;
      prompt: string;
      providerID: string | null;
      modelID: string | null;
    }
  | { type: 'agent_invoked'; partID: string; name: string }
  | {
      type: 'context_usage';
      providerID: string | null;
      modelID: string | null;
      tokens: ContextUsageTokens;
    }
  | { type: 'file_written'; path: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

type StreamSessionEventsOptions = {
  onEvent?: (event: Event) => void;
};

const readSessionID = (event: Event): string | undefined => {
  const props = event.properties as { sessionID?: unknown; part?: { sessionID?: unknown } };
  if (typeof props.sessionID === 'string') {
    return props.sessionID;
  }
  if (typeof props.part?.sessionID === 'string') {
    return props.part.sessionID;
  }
  return undefined;
};

// SDK part discriminator: `'reasoning'` is the literal name in
// @opencode-ai/sdk@1.4.3 (`ReasoningPart` in dist/v2/gen/types.gen.d.ts).
const asToolEvent = (part: ToolPart): TinkerStreamEvent | null => {
  if (part.state.status === 'pending' || part.state.status === 'running') {
    return {
      type: 'tool_call',
      partID: part.id,
      name: part.tool,
      input: part.state.input,
    };
  }

  if (part.state.status === 'completed') {
    return {
      type: 'tool_result',
      partID: part.id,
      name: part.tool,
      output: part.state.output,
    };
  }

  if (part.state.status === 'error') {
    return {
      type: 'tool_error',
      partID: part.id,
      name: part.tool,
      message: part.state.error,
    };
  }

  return null;
};

const asSubtaskEvent = (part: SubtaskPart): TinkerStreamEvent => {
  return {
    type: 'subtask',
    partID: part.id,
    agent: part.agent,
    description: part.description,
    prompt: part.prompt,
    providerID: part.model?.providerID ?? null,
    modelID: part.model?.modelID ?? null,
  };
};

const asAgentInvokedEvent = (part: AgentPart): TinkerStreamEvent => {
  return {
    type: 'agent_invoked',
    partID: part.id,
    name: part.name,
  };
};

const asFileWrites = (part: Part): TinkerStreamEvent[] => {
  if (part.type === 'patch') {
    return part.files.map((path) => ({ type: 'file_written', path }));
  }

  if (part.type === 'file' && part.source?.type === 'file') {
    return [{ type: 'file_written', path: part.source.path }];
  }

  return [];
};

const readContextUsageTokens = (value: unknown): ContextUsageTokens | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const usage = value as {
    total?: unknown;
    input?: unknown;
    output?: unknown;
    reasoning?: unknown;
  };

  if (
    typeof usage.input !== 'number'
    || typeof usage.output !== 'number'
    || typeof usage.reasoning !== 'number'
  ) {
    return null;
  }

  return {
    ...(typeof usage.total === 'number' ? { total: usage.total } : {}),
    input: usage.input,
    output: usage.output,
    reasoning: usage.reasoning,
  };
};

const asContextUsageFromMessage = (
  event: Extract<Event, { type: 'message.updated' }>,
): TinkerStreamEvent | null => {
  const info = event.properties.info as {
    role?: unknown;
    providerID?: unknown;
    modelID?: unknown;
    tokens?: unknown;
  };

  if (info.role !== 'assistant') {
    return null;
  }

  const tokens = readContextUsageTokens(info.tokens);
  if (!tokens) {
    return null;
  }

  return {
    type: 'context_usage',
    providerID: typeof info.providerID === 'string' ? info.providerID : null,
    modelID: typeof info.modelID === 'string' ? info.modelID : null,
    tokens,
  };
};

const asContextUsageFromPart = (part: Part): TinkerStreamEvent | null => {
  if (part.type !== 'step-finish') {
    return null;
  }

  const tokens = readContextUsageTokens(part.tokens);
  if (!tokens) {
    return null;
  }

  return {
    type: 'context_usage',
    providerID: null,
    modelID: null,
    tokens,
  };
};

const readErrorMessage = (event: Extract<Event, { type: 'session.error' }>): string => {
  const error = event.properties.error;
  if (!error) {
    return 'OpenCode reported an unknown session error.';
  }
  const data = (error as { data?: { message?: unknown } }).data;
  if (typeof data?.message === 'string' && data.message.length > 0) {
    return data.message;
  }
  return error.name;
};

export const streamSessionEvents = async function* (
  client: Pick<OpencodeClient, 'event'>,
  sessionID: string,
  options: StreamSessionEventsOptions = {},
): AsyncIterable<TinkerStreamEvent> {
  const subscription = await client.event.subscribe();
  // Track which partIDs are reasoning parts so the matching delta events can
  // be surfaced as `reasoning` rather than `token` (delta events lack the
  // discriminator and only carry partID).
  const reasoningPartIDs = new Set<string>();
  // SubtaskPart and AgentPart are single-shot (no state machine), but the
  // SDK can re-fire `message.part.updated` for the same partID. Dedupe so
  // the renderer sees one event per part.
  const emittedSubtaskPartIDs = new Set<string>();
  const emittedAgentPartIDs = new Set<string>();

  for await (const event of subscription.stream) {
    if (readSessionID(event) !== sessionID) {
      continue;
    }

    try {
      options.onEvent?.(event);
    } catch (error) {
      console.warn('Failed to process raw OpenCode event side effect.', error);
    }

    if (event.type === 'message.updated') {
      const usageEvent = asContextUsageFromMessage(event);
      if (usageEvent) {
        yield usageEvent;
      }
      continue;
    }

    if (event.type === 'message.part.delta' && event.properties.field === 'text') {
      const { partID, delta } = event.properties;
      if (reasoningPartIDs.has(partID)) {
        yield { type: 'reasoning', partID, text: delta };
      } else {
        yield { type: 'token', partID, text: delta };
      }
      continue;
    }

    if (event.type === 'message.part.updated') {
      const { part } = event.properties;
      const usageEvent = asContextUsageFromPart(part);
      if (usageEvent) {
        yield usageEvent;
      }

      if (part.type === 'reasoning') {
        // Mark this partID so the streaming text deltas (which carry no type
        // discriminator) get classified as reasoning. The delta stream owns
        // text propagation; we don't re-emit `part.text` here to avoid
        // duplicating chunks.
        reasoningPartIDs.add(part.id);
      }

      if (part.type === 'tool') {
        const toolEvent = asToolEvent(part);
        if (toolEvent) {
          yield toolEvent;
        }
      }

      if (part.type === 'subtask' && !emittedSubtaskPartIDs.has(part.id)) {
        emittedSubtaskPartIDs.add(part.id);
        yield asSubtaskEvent(part);
      }

      if (part.type === 'agent' && !emittedAgentPartIDs.has(part.id)) {
        emittedAgentPartIDs.add(part.id);
        yield asAgentInvokedEvent(part);
      }

      for (const fileEvent of asFileWrites(part)) {
        yield fileEvent;
      }

      continue;
    }

    if (event.type === 'session.idle') {
      yield { type: 'done' };
      return;
    }

    if (event.type === 'session.error') {
      yield {
        type: 'error',
        message: readErrorMessage(event),
      };
      return;
    }
  }
};
