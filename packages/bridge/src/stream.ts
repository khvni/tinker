import type { Event, OpencodeClient, Part, ToolPart } from '@opencode-ai/sdk/v2/client';

export type TinkerStreamEvent =
  | { type: 'token'; partID: string; text: string }
  | { type: 'reasoning'; partID: string; text: string }
  | { type: 'tool_call'; partID: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; partID: string; name: string; output: string }
  | { type: 'tool_error'; partID: string; name: string; message: string }
  | { type: 'file_written'; path: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

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

const asFileWrites = (part: Part): TinkerStreamEvent[] => {
  if (part.type === 'patch') {
    return part.files.map((path) => ({ type: 'file_written', path }));
  }

  if (part.type === 'file' && part.source?.type === 'file') {
    return [{ type: 'file_written', path: part.source.path }];
  }

  return [];
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
): AsyncIterable<TinkerStreamEvent> {
  const subscription = await client.event.subscribe();
  // Track which partIDs are reasoning parts so the matching delta events can
  // be surfaced as `reasoning` rather than `token` (delta events lack the
  // discriminator and only carry partID).
  const reasoningPartIDs = new Set<string>();

  for await (const event of subscription.stream) {
    if (readSessionID(event) !== sessionID) {
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
