export type ScheduleOutput =
  | { type: 'slack'; channel: string }
  | { type: 'workspace' };

export type ScheduledJob = {
  id: string;
  ownerUserId: string;
  prompt: string;
  cron: string;
  output: ScheduleOutput;
  lastRunAt?: string;
  lastStatus?: 'success' | 'error';
  createdAt: string;
};

export type JobRunResult = {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'error';
  transcript: string;
  error?: string;
};

export type PermissionRequest = {
  id: string;
  jobId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
};

export type PermissionDecision = {
  requestId: string;
  decision: 'approve' | 'deny';
  decidedAt: string;
  decidedBy: string;
};

export type Scheduler = {
  create(job: Omit<ScheduledJob, 'id' | 'createdAt'>): Promise<ScheduledJob>;
  list(ownerUserId: string): Promise<ScheduledJob[]>;
  remove(id: string): Promise<void>;
  runNow(id: string): Promise<JobRunResult>;
  onPermissionNeeded(handler: (req: PermissionRequest) => Promise<PermissionDecision>): void;
};
