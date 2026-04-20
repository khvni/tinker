import type { Event, OpencodeClient, Part, ToolPart } from '@opencode-ai/sdk/v2/client';

export type TinkerStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; output: string }
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

const asToolCall = (part: ToolPart): TinkerStreamEvent | null => {
  if (part.state.status === 'pending' || part.state.status === 'running') {
    return {
      type: 'tool_call',
      name: part.tool,
      input: part.state.input,
    };
  }

  if (part.state.status === 'completed') {
    return {
      type: 'tool_result',
      name: part.tool,
      output: part.state.output,
    };
  }

  return {
    type: 'error',
    message: part.state.error,
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

  for await (const event of subscription.stream) {
    if (readSessionID(event) !== sessionID) {
      continue;
    }

    if (event.type === 'message.part.delta' && event.properties.field === 'text') {
      yield { type: 'token', text: event.properties.delta };
      continue;
    }

    if (event.type === 'message.part.updated') {
      const { part } = event.properties;

      if (part.type === 'tool') {
        const toolEvent = asToolCall(part);
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
