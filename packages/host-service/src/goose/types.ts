import type { RunConfig, RunEvent, RunStatus } from '@tinker/shared-types';

export type GooseSpawnConfig = {
  cwd: string;
  prompt: string;
  mode: string | null;
  gooseBin: string;
};

export type ActiveRun = {
  runId: string;
  config: RunConfig;
  status: RunStatus;
  pid: number | undefined;
  createdAt: string;
  abort: () => void;
};

export type RunEventListener = (event: RunEvent) => void;
