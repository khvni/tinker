import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledJob } from '@tinker/shared-types';
import { getDatabase } from './database.js';
import { createScheduledJobStore } from './scheduler-store.js';

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

type JobRow = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  timezone: string;
  output_sinks_json: string;
  enabled: number;
  last_run_at: string | null;
  last_run_status: 'success' | 'error' | 'skipped' | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
  task_kind: string | null;
};

const createFakeDatabase = () => {
  const rows = new Map<string, JobRow>();
  return {
    rows,
    select: vi.fn(async (query: string, bindValues: unknown[] = []): Promise<JobRow[]> => {
      if (!query.includes('FROM jobs')) {
        return [];
      }
      if (query.includes('WHERE id = $1')) {
        const [id] = bindValues as [string];
        const row = rows.get(id);
        return row ? [row] : [];
      }
      return Array.from(rows.values());
    }),
    execute: vi.fn(async (query: string, bindValues: unknown[] = []) => {
      if (query.startsWith('INSERT INTO jobs')) {
        const [
          id,
          name,
          prompt,
          schedule,
          timezone,
          output_sinks_json,
          enabled,
          last_run_at,
          last_run_status,
          next_run_at,
          created_at,
          updated_at,
          task_kind,
        ] = bindValues as [
          string,
          string,
          string,
          string,
          string,
          string,
          number,
          string | null,
          'success' | 'error' | 'skipped' | null,
          string,
          string,
          string,
          string,
        ];
        rows.set(id, {
          id,
          name,
          prompt,
          schedule,
          timezone,
          output_sinks_json,
          enabled,
          last_run_at,
          last_run_status,
          next_run_at,
          created_at,
          updated_at,
          task_kind,
        });
      }
    }),
  };
};

const baseJob = (overrides: Partial<ScheduledJob> & Pick<ScheduledJob, 'id' | 'task'>): ScheduledJob => ({
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

describe('scheduler-store task discriminator', () => {
  beforeEach(() => {
    vi.mocked(getDatabase).mockReset();
  });

  it('round-trips a memory-sweep job through saveJob/getJob', async () => {
    const fake = createFakeDatabase();
    vi.mocked(getDatabase).mockResolvedValue(fake as never);

    const store = createScheduledJobStore();
    const job = baseJob({
      id: 'system:daily-memory-sweep',
      name: 'Daily memory sweep',
      task: { kind: 'memory-sweep' },
    });

    await store.saveJob(job);
    const fetched = await store.getJob(job.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.task).toEqual({ kind: 'memory-sweep' });
    expect(fetched?.name).toBe('Daily memory sweep');
  });

  it('defaults legacy rows with no task_kind to a prompt task', async () => {
    const fake = createFakeDatabase();
    fake.rows.set('legacy', {
      id: 'legacy',
      name: 'Legacy daily summary',
      prompt: 'Summarize today.',
      schedule: '0 9 * * *',
      timezone: 'UTC',
      output_sinks_json: '[]',
      enabled: 1,
      last_run_at: null,
      last_run_status: null,
      next_run_at: '2026-04-22T09:00:00.000Z',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
      task_kind: null,
    });
    vi.mocked(getDatabase).mockResolvedValue(fake as never);

    const store = createScheduledJobStore();
    const fetched = await store.getJob('legacy');

    expect(fetched?.task).toEqual({ kind: 'prompt' });
  });

  it('coerces unknown task_kind values to prompt to stay forward-compatible', async () => {
    const fake = createFakeDatabase();
    fake.rows.set('future', {
      id: 'future',
      name: 'Future job',
      prompt: 'Future task.',
      schedule: '0 9 * * *',
      timezone: 'UTC',
      output_sinks_json: '[]',
      enabled: 1,
      last_run_at: null,
      last_run_status: null,
      next_run_at: '2026-04-22T09:00:00.000Z',
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
      task_kind: 'rebuild-galaxy',
    });
    vi.mocked(getDatabase).mockResolvedValue(fake as never);

    const store = createScheduledJobStore();
    const fetched = await store.getJob('future');

    expect(fetched?.task).toEqual({ kind: 'prompt' });
  });
});
