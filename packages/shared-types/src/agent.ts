export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type TextBlock = { type: 'text'; text: string };
export type ToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type ToolResultBlock = {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
};

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type Message = {
  role: Role;
  content: ContentBlock[];
};

export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
  ctx: TurnContext,
) => Promise<string>;

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'pause_turn';

export type TurnContext = {
  userId: string;
  sessionId: string;
  model?: 'claude-sonnet-4-6' | 'claude-opus-4-6';
  history: Message[];
  userMessage: Message;
  systemPrompt: string;
  tools: ToolDescriptor[];
  onToken?: (token: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  signal?: AbortSignal;
};

export type TurnResult = {
  messages: Message[];
  stopReason: StopReason;
  truncated?: boolean;
};

export type AgentRuntime = {
  runTurn(ctx: TurnContext): Promise<TurnResult>;
};
