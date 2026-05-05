import type { OpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { ScheduledJob, ScheduledJobRun, ScheduledJobStore } from '@tinker/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchedulerEngine } from './engine.js';

type MutableStore = ScheduledJobStore & {
  jobs: Map<string, ScheduledJob>;
  runs: ScheduledJobRun[];
};

const buildJob = (overrides: Partial<ScheduledJob> & Pick<ScheduledJob, 'id' | 'task'>): ScheduledJob => ({
  name: 'Test Job',
  prompt: '',
  schedule: '0 4 * * *',
  timezone: 'UTC',
  outputSinks: [],
  enabled: true,
  lastRunAt: null,
  lastRunStatus: null,
  nextRunAt: '2026-04-22T04:00:00.000Z',
  createdAt: '2026-04-21T00:00:00.000Z',
  updatedAt: '2026-04-21T00:00:00.000Z',
  ...overrides,
});

const createStore = (): MutableStore => {
  const jobs = new Map<string, ScheduledJob>();
  const runs: ScheduledJobRun[] = [];
  return {
    jobs,
    runs,
    async listJobs() {
      return Array.from(jobs.values());
    },
    async getJob(id) {
      return jobs.get(id) ?? null;
    },
    async saveJob(job) {
      jobs.set(job.id, job);
    },
    async deleteJob(id) {
      jobs.delete(id);
    },
    async listDueJobs() {
      return Array.from(jobs.values());
    },
    async recordRun(run) {
      runs.push(run);
    },
    async listRuns(jobId, limit = 10) {
      return runs.filter((run) => run.jobId === jobId).slice(-limit).reverse();
    },
    async listTodayEntries() {
      return [];
    },
  };
};

const stubClient: OpencodeClient = {
  session: {
    create: vi.fn(),
    prompt: vi.fn(),
  },
} as unknown as OpencodeClient;

describe('scheduler engine memory-sweep dispatch', () => {
  beforeEach(() => {
    if (typeof crypto.randomUUID !== 'function') {
      // Vitest's jsdom env exposes crypto, but be defensive across runners.
      throw new Error('crypto.randomUUID must be available for engine tests.');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs runMemorySweep handler for memory-sweep tasks and records a success run', async () => {
    const store = createStore();
    const job = buildJob({
      id: 'system:daily-memory-sweep',
      name: 'Daily memory sweep',
      task: { kind: 'memory-sweep' },
    });
    store.jobs.set(job.id, job);

    const runMemorySweep = vi.fn().mockResolvedValue('Indexed 3 entities; flagged 1 stale.');

    const engine = createSchedulerEngine({
      jobStore: store,
      vaultService: null,
      createClient: () => stubClient,
      runMemorySweep,
      now: () => new Date('2026-04-22T04:00:30.000Z'),
    });

    await engine.runNow(job.id);

    expect(runMemorySweep).toHaveBeenCalledTimes(1);
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.status).toBe('success');
    expect(store.runs[0]?.outputText).toContain('Indexed 3 entities');
    expect(store.runs[0]?.trigger).toBe('manual');
    expect(store.jobs.get(job.id)?.lastRunStatus).toBe('success');
  });

  it('records an error run when the memory-sweep handler throws', async () => {
    const store = createStore();
    const job = buildJob({
      id: 'system:daily-memory-sweep',
      task: { kind: 'memory-sweep' },
    });
    store.jobs.set(job.id, job);

    const runMemorySweep = vi.fn().mockRejectedValue(new Error('vault offline'));

    const engine = createSchedulerEngine({
      jobStore: store,
      vaultService: null,
      createClient: () => stubClient,
      runMemorySweep,
      now: () => new Date('2026-04-22T04:00:30.000Z'),
    });

    await engine.runNow(job.id);

    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.status).toBe('error');
    expect(store.runs[0]?.errorText).toBe('vault offline');
    expect(store.jobs.get(job.id)?.lastRunStatus).toBe('error');
  });

  it('errors out when a memory-sweep job runs without a runMemorySweep handler wired', async () => {
    const store = createStore();
    const job = buildJob({
      id: 'system:daily-memory-sweep',
      task: { kind: 'memory-sweep' },
    });
    store.jobs.set(job.id, job);

    const engine = createSchedulerEngine({
      jobStore: store,
      vaultService: null,
      createClient: () => stubClient,
      now: () => new Date('2026-04-22T04:00:30.000Z'),
    });

    await engine.runNow(job.id);

    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.status).toBe('error');
    expect(store.runs[0]?.errorText).toContain('runMemorySweep');
  });

  it('skips runs missed beyond the grace window without invoking the memory sweep', async () => {
    const store = createStore();
    const job = buildJob({
      id: 'system:daily-memory-sweep',
      task: { kind: 'memory-sweep' },
      nextRunAt: '2026-04-21T04:00:00.000Z',
    });
    store.jobs.set(job.id, job);

    const runMemorySweep = vi.fn();

    const engine = createSchedulerEngine({
      jobStore: store,
      vaultService: null,
      createClient: () => stubClient,
      runMemorySweep,
      now: () => new Date('2026-04-22T04:30:00.000Z'),
    });

    await engine.tick();

    expect(runMemorySweep).not.toHaveBeenCalled();
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.status).toBe('skipped');
    expect(store.runs[0]?.skippedCount).toBeGreaterThan(0);
  });
});
