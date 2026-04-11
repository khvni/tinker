import type {
  DailySynthesisResult,
  MemoryBootstrapInput,
  MemoryBootstrapResult,
  MemoryStore,
} from '@ramp-glass/shared-types';

export const createMemoryStore = (_config: { dbPath: string }): MemoryStore => {
  return {
    upsertEntity: async () => {
      throw new Error('memory.upsertEntity: not yet implemented — see tasks/memory.md');
    },
    upsertRelationship: async () => {
      throw new Error('memory.upsertRelationship: not yet implemented — see tasks/memory.md');
    },
    getEntity: async () => {
      throw new Error('memory.getEntity: not yet implemented — see tasks/memory.md');
    },
    search: async () => {
      throw new Error('memory.search: not yet implemented — see tasks/memory.md');
    },
    recentSessions: async () => {
      throw new Error('memory.recentSessions: not yet implemented — see tasks/memory.md');
    },
    recordSession: async () => {
      throw new Error('memory.recordSession: not yet implemented — see tasks/memory.md');
    },
  };
};

export const runMemoryBootstrap = async (
  _input: MemoryBootstrapInput,
): Promise<MemoryBootstrapResult> => {
  throw new Error('runMemoryBootstrap: not yet implemented — see tasks/memory.md');
};

export const runDailySynthesis = async (_userId: string): Promise<DailySynthesisResult> => {
  throw new Error('runDailySynthesis: not yet implemented — see tasks/memory.md');
};
