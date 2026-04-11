import type { AgentRuntime, TurnContext, TurnResult } from '@ramp-glass/shared-types';

export const createAgentRuntime = (_config: {
  apiKey: string;
  defaultModel?: 'claude-sonnet-4-6' | 'claude-opus-4-6';
}): AgentRuntime => {
  return {
    runTurn: async (_ctx: TurnContext): Promise<TurnResult> => {
      throw new Error('agent-runtime.runTurn: not yet implemented — see tasks/agent-runtime.md');
    },
  };
};
