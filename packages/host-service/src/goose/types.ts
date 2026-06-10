/**
 * Goose process-level types. These describe the raw events emitted by the
 * Goose CLI adapter — stdout/stderr text, process status changes, and
 * spawn errors. They are intentionally separate from the chat-level
 * `RunEvent` union in `@tinker/shared-types`, which is the normalized
 * surface the renderer consumes.
 */

export const GOOSE_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'aborted',
] as const;

export type GooseRunStatus = (typeof GOOSE_RUN_STATUSES)[number];

export type GooseRunEventText = {
  type: 'text';
  runId: string;
  content: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
};

export type GooseRunEventStatus = {
  type: 'status';
  runId: string;
  status: GooseRunStatus;
  timestamp: string;
};

export type GooseRunEventError = {
  type: 'error';
  runId: string;
  message: string;
  recoverable: boolean;
  timestamp: string;
};

export type GooseRunEvent = GooseRunEventText | GooseRunEventStatus | GooseRunEventError;

export type GooseRunConfig = {
  cwd: string;
  prompt: string;
  mode: string | null;
};

export type GooseRunSummary = {
  runId: string;
  status: GooseRunStatus;
  config: GooseRunConfig;
  createdAt: string;
  finishedAt: string | null;
  eventCount: number;
};

export type GooseSpawnConfig = {
  cwd: string;
  prompt: string;
  mode: string | null;
  gooseBin: string;
};

export type ActiveRun = {
  runId: string;
  config: GooseRunConfig;
  status: GooseRunStatus;
  pid: number | undefined;
  createdAt: string;
  abort: () => void;
};

export type GooseRunEventListener = (event: GooseRunEvent) => void;
