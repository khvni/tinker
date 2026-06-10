import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ActiveRun, GooseRunConfig, GooseRunEvent, GooseRunEventListener, GooseRunStatus, GooseSpawnConfig } from './types.js';
import type { RunEventLog } from './event-log.js';

const DEFAULT_GOOSE_BIN = 'goose';

const SIGTERM_GRACE_MS = 5_000;

const now = (): string => new Date().toISOString();

const statusEvent = (runId: string, status: GooseRunStatus): GooseRunEvent => ({
  type: 'status',
  runId,
  status,
  timestamp: now(),
});

const textEvent = (runId: string, content: string, stream: 'stdout' | 'stderr'): GooseRunEvent => ({
  type: 'text',
  runId,
  content,
  stream,
  timestamp: now(),
});

const errorEvent = (runId: string, message: string, recoverable: boolean): GooseRunEvent => ({
  type: 'error',
  runId,
  message,
  recoverable,
  timestamp: now(),
});

export type GooseRuntimeAdapter = {
  startRun(config: GooseRunConfig): string;
  abortRun(runId: string): boolean;
  getActiveRun(runId: string): ActiveRun | undefined;
  listActiveRuns(): ActiveRun[];
  subscribe(listener: GooseRunEventListener): () => void;
  shutdown(): void;
};

export type CreateAdapterOptions = {
  eventLog: RunEventLog;
  gooseBin?: string | undefined;
};

export const resolveGooseBin = (override: string | undefined): string => {
  return override ?? DEFAULT_GOOSE_BIN;
};

export const createGooseRuntimeAdapter = (options: CreateAdapterOptions): GooseRuntimeAdapter => {
  const { eventLog } = options;
  const gooseBin = resolveGooseBin(options.gooseBin);
  const activeRuns = new Map<string, ActiveRun>();
  const emitter = new EventEmitter();

  const emit = (event: GooseRunEvent): void => {
    eventLog.append(event.runId, event);
    emitter.emit('event', event);
  };

  const startRun = (config: GooseRunConfig): string => {
    const runId = randomUUID();
    const spawnConfig: GooseSpawnConfig = {
      cwd: config.cwd,
      prompt: config.prompt,
      mode: config.mode,
      gooseBin,
    };

    eventLog.init(runId, config);

    emit(statusEvent(runId, 'queued'));

    const args = buildArgs(spawnConfig);

    let child;
    try {
      child = spawn(spawnConfig.gooseBin, args, {
        cwd: spawnConfig.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to spawn Goose process.';
      emit(errorEvent(runId, formatMissingGooseError(message), true));
      emit(statusEvent(runId, 'failed'));
      return runId;
    }

    const abortController = new AbortController();
    let settled = false;

    const settle = (finalStatus: 'completed' | 'failed' | 'aborted'): void => {
      if (settled) return;
      settled = true;
      run.status = finalStatus;
      emit(statusEvent(runId, finalStatus));
      activeRuns.delete(runId);
    };

    const run: ActiveRun = {
      runId,
      config,
      status: 'running',
      pid: child.pid,
      createdAt: now(),
      abort: () => {
        if (abortController.signal.aborted) return;
        abortController.abort();
        if (child.pid !== undefined) {
          child.kill('SIGTERM');
          setTimeout(() => {
            try { child.kill('SIGKILL'); } catch { /* already exited */ }
          }, SIGTERM_GRACE_MS);
        }
      },
    };

    activeRuns.set(runId, run);
    emit(statusEvent(runId, 'running'));

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (text.length > 0) {
        emit(textEvent(runId, text, 'stdout'));
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (text.length > 0) {
        emit(textEvent(runId, text, 'stderr'));
      }
    });

    child.on('error', (err) => {
      emit(errorEvent(runId, formatMissingGooseError(err.message), true));
      settle('failed');
    });

    child.on('close', (code) => {
      if (abortController.signal.aborted) {
        settle('aborted');
      } else if (code === 0) {
        settle('completed');
      } else {
        settle('failed');
      }
    });

    return runId;
  };

  const abortRun = (runId: string): boolean => {
    const run = activeRuns.get(runId);
    if (run === undefined) return false;
    run.abort();
    return true;
  };

  const subscribe = (listener: GooseRunEventListener): (() => void) => {
    emitter.on('event', listener);
    return () => { emitter.off('event', listener); };
  };

  const shutdown = (): void => {
    for (const run of activeRuns.values()) {
      run.abort();
    }
    emitter.removeAllListeners();
  };

  return {
    startRun,
    abortRun,
    getActiveRun: (runId) => activeRuns.get(runId),
    listActiveRuns: () => [...activeRuns.values()],
    subscribe,
    shutdown,
  };
};

const buildArgs = (config: GooseSpawnConfig): string[] => {
  const args = ['run', '-t', config.prompt];
  if (config.mode !== null) {
    args.push('--profile', config.mode);
  }
  return args;
};

const formatMissingGooseError = (raw: string): string => {
  if (raw.includes('ENOENT') || raw.includes('not found') || raw.includes('No such file')) {
    return (
      'Goose CLI not found. Install it with:\n' +
      '  curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash\n' +
      'Then ensure "goose" is on your PATH.'
    );
  }
  return `Goose process error: ${raw}`;
};
