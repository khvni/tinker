import type { ScheduledJob, ScheduledJobStore } from '@tinker/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_MEMORY_SWEEP_SCHEDULE,
  SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID,
  ensureDailyMemorySweepJob,
} from './bootstrap.js';

const createStore = (initial?: ScheduledJob): ScheduledJobStore & { saved: ScheduledJob[] } => {
  const jobs = new Map<string, ScheduledJob>();
  if (initial) jobs.set(initial.id, initial);
  const saved: ScheduledJob[] = [];

  return {
    saved,
    async listJobs() {
      return Array.from(jobs.values());
    },
    async getJob(id) {
      return jobs.get(id) ?? null;
    },
    async saveJob(job) {
      saved.push(job);
      jobs.set(job.id, job);
    },
    async deleteJob(id) {
      jobs.delete(id);
    },
    async listDueJobs() {
      return [];
    },
    async recordRun() {},
    async listRuns() {
      return [];
    },
    async listTodayEntries() {
      return [];
    },
  };
};

describe('ensureDailyMemorySweepJob', () => {
  it('seeds the singleton job with a memory-sweep task and the default schedule when missing', async () => {
    const store = createStore();
    const now = new Date('2026-04-21T12:00:00.000Z');

    const job = await ensureDailyMemorySweepJob(store, { now: () => now, timezone: 'UTC' });

    expect(job.id).toBe(SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID);
    expect(job.task.kind).toBe('memory-sweep');
    expect(job.schedule).toBe(DAILY_MEMORY_SWEEP_SCHEDULE);
    expect(job.timezone).toBe('UTC');
    expect(job.enabled).toBe(true);
    expect(job.outputSinks).toEqual([]);
    expect(store.saved).toHaveLength(1);
  });

  it('preserves existing memory-sweep rows without rewriting them', async () => {
    const existing: ScheduledJob = {
      id: SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID,
      name: 'Daily memory sweep',
      prompt: '',
      schedule: DAILY_MEMORY_SWEEP_SCHEDULE,
      timezone: 'UTC',
      outputSinks: [],
      enabled: true,
      lastRunAt: '2026-04-20T04:00:00.000Z',
      lastRunStatus: 'success',
      nextRunAt: '2026-04-22T04:00:00.000Z',
      task: { kind: 'memory-sweep' },
      createdAt: '2026-04-19T04:00:00.000Z',
      updatedAt: '2026-04-20T04:00:00.000Z',
    };
    const store = createStore(existing);
    const saveSpy = vi.spyOn(store, 'saveJob');

    const job = await ensureDailyMemorySweepJob(store, {
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(job).toBe(existing);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('rewrites a legacy prompt-task row into a memory-sweep task while keeping run history', async () => {
    const legacy: ScheduledJob = {
      id: SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID,
      name: 'Daily memory sweep (legacy)',
      prompt: 'Old prompt',
      schedule: '0 9 * * *',
      timezone: 'UTC',
      outputSinks: [],
      enabled: true,
      lastRunAt: '2026-04-19T09:00:00.000Z',
      lastRunStatus: 'error',
      nextRunAt: '2026-04-20T09:00:00.000Z',
      task: { kind: 'prompt' },
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-19T09:00:00.000Z',
    };
    const store = createStore(legacy);

    const job = await ensureDailyMemorySweepJob(store, {
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(job.task).toEqual({ kind: 'memory-sweep' });
    expect(job.schedule).toBe(DAILY_MEMORY_SWEEP_SCHEDULE);
    expect(job.lastRunAt).toBe(legacy.lastRunAt);
    expect(job.lastRunStatus).toBe(legacy.lastRunStatus);
    expect(job.createdAt).toBe(legacy.createdAt);
  });
});
