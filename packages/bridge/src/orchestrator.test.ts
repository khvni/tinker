import { describe, expect, it, vi } from 'vitest';
import type { Agent, OpencodeClient } from '@opencode-ai/sdk/v2/client';
import { MAX_PARALLEL_SUBAGENTS, listSubagents } from './orchestrator.js';

const makeAgent = (overrides: Partial<Agent>): Agent =>
  ({
    name: overrides.name ?? 'agent',
    mode: overrides.mode ?? 'subagent',
    permission: [],
    options: {},
    ...overrides,
  }) as Agent;

const makeClient = (agents: Agent[] | undefined): Pick<OpencodeClient, 'app'> =>
  ({
    app: {
      agents: vi.fn().mockResolvedValue({ data: agents }),
    },
  }) as unknown as Pick<OpencodeClient, 'app'>;

describe('listSubagents', () => {
  it('returns agents declared as subagent or all', async () => {
    const subagent = makeAgent({ name: 'gong-researcher', mode: 'subagent' });
    const allAgent = makeAgent({ name: 'shared', mode: 'all' });
    const primary = makeAgent({ name: 'build', mode: 'primary' });

    const client = makeClient([subagent, allAgent, primary]);

    const result = await listSubagents(client);

    expect(result).toEqual([subagent, allAgent]);
  });

  it('returns an empty array when the SDK reports no agents', async () => {
    const client = makeClient(undefined);

    const result = await listSubagents(client);

    expect(result).toEqual([]);
  });
});

describe('MAX_PARALLEL_SUBAGENTS', () => {
  it('is set to the v1 cap of 5', () => {
    expect(MAX_PARALLEL_SUBAGENTS).toBe(5);
  });
});
