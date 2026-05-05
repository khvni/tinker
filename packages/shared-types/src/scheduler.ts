export type ScheduledOutputSink =
  | { type: 'vault-append'; path: string }
  | { type: 'notification'; title: string }
  | { type: 'today-pane'; section: string };

export type ScheduledJobRunStatus = 'success' | 'error' | 'skipped';

export type ScheduledJobTask =
  | { kind: 'prompt' }
  | { kind: 'memory-sweep' };

export type ScheduledJobTaskKind = ScheduledJobTask['kind'];

export type ScheduledJob = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  timezone: string;
  outputSinks: ScheduledOutputSink[];
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: ScheduledJobRunStatus | null;
  nextRunAt: string;
  task: ScheduledJobTask;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledJobRun = {
  id: string;
  jobId: string;
  trigger: 'schedule' | 'manual';
  scheduledFor: string;
  startedAt: string;
  finishedAt: string;
  status: ScheduledJobRunStatus;
  outputText: string | null;
  errorText: string | null;
  deliveredSinks: ScheduledOutputSink[];
  skippedCount: number;
};

export type ScheduledTodayEntry = {
  runId: string;
  jobId: string;
  jobName: string;
  section: string;
  outputText: string;
  finishedAt: string;
};

export type ScheduledJobStore = {
  listJobs(): Promise<ScheduledJob[]>;
  getJob(id: string): Promise<ScheduledJob | null>;
  saveJob(job: ScheduledJob): Promise<void>;
  deleteJob(id: string): Promise<void>;
  listDueJobs(now: string): Promise<ScheduledJob[]>;
  recordRun(run: ScheduledJobRun): Promise<void>;
  listRuns(jobId: string, limit?: number): Promise<ScheduledJobRun[]>;
  listTodayEntries(limit?: number): Promise<ScheduledTodayEntry[]>;
};
