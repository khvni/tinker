import type { ScheduledJob, ScheduledJobStore } from '@tinker/shared-types';
import { getFutureRunAfter } from './schedule.js';

export const SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID = 'system:daily-memory-sweep';
export const DAILY_MEMORY_SWEEP_SCHEDULE = '0 4 * * *';
export const DAILY_MEMORY_SWEEP_NAME = 'Daily memory sweep';

const resolveTimezone = (override?: string): string => {
  if (override && override.length > 0) return override;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const ensureDailyMemorySweepJob = async (
  store: ScheduledJobStore,
  options?: { now?: () => Date; timezone?: string },
): Promise<ScheduledJob> => {
  const existing = await store.getJob(SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID);
  if (existing && existing.task.kind === 'memory-sweep') {
    return existing;
  }

  const nowFn = options?.now ?? (() => new Date());
  const now = nowFn();
  const timezone = resolveTimezone(options?.timezone);
  const stamp = now.toISOString();
  const nextRunAt = getFutureRunAfter(DAILY_MEMORY_SWEEP_SCHEDULE, timezone, now);

  const job: ScheduledJob = {
    id: SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID,
    name: DAILY_MEMORY_SWEEP_NAME,
    prompt: '',
    schedule: DAILY_MEMORY_SWEEP_SCHEDULE,
    timezone,
    outputSinks: [],
    enabled: true,
    lastRunAt: existing?.lastRunAt ?? null,
    lastRunStatus: existing?.lastRunStatus ?? null,
    nextRunAt,
    task: { kind: 'memory-sweep' },
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };

  await store.saveJob(job);
  return job;
};
