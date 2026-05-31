export const RUN_STATUSES = [
  'queued',
  'running',
  'waiting_for_approval',
  'completed',
  'failed',
  'aborted',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export type RunEventText = {
  type: 'text';
  runId: string;
  content: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
};

export type RunEventStatus = {
  type: 'status';
  runId: string;
  status: RunStatus;
  timestamp: string;
};

export type RunEventError = {
  type: 'error';
  runId: string;
  message: string;
  recoverable: boolean;
  timestamp: string;
};

export type RunEvent = RunEventText | RunEventStatus | RunEventError;

export type RunConfig = {
  cwd: string;
  prompt: string;
  mode: string | null;
};

export type RunSummary = {
  runId: string;
  status: RunStatus;
  config: RunConfig;
  createdAt: string;
  finishedAt: string | null;
  eventCount: number;
};

export type StartRunRequest = {
  cwd: string;
  prompt: string;
  mode?: string;
};

export type StartRunResponse = {
  runId: string;
};

export type AbortRunRequest = {
  runId: string;
};

export type AbortRunResponse = {
  runId: string;
  aborted: boolean;
};
