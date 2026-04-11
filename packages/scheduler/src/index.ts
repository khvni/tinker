import type { JobRunResult, Scheduler } from '@ramp-glass/shared-types';

export const createScheduler = (_config: { dbPath: string }): Scheduler => {
  return {
    create: async () => {
      throw new Error('scheduler.create: not yet implemented — see tasks/scheduler.md');
    },
    list: async () => {
      throw new Error('scheduler.list: not yet implemented — see tasks/scheduler.md');
    },
    remove: async () => {
      throw new Error('scheduler.remove: not yet implemented — see tasks/scheduler.md');
    },
    runNow: async (): Promise<JobRunResult> => {
      throw new Error('scheduler.runNow: not yet implemented — see tasks/scheduler.md');
    },
    onPermissionNeeded: () => {
      throw new Error('scheduler.onPermissionNeeded: not yet implemented — see tasks/scheduler.md');
    },
  };
};
