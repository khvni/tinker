import { useEffect, useState, type JSX } from 'react';
import { Button } from '@tinker/design';
import type { MemoryRunState } from '@tinker/memory';
import type { ScheduledJobRun, ScheduledJobStore } from '@tinker/shared-types';
import { SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID } from '@tinker/scheduler';
import './MemorySweepDiagnosticsCard.css';

export type MemorySweepDiagnosticsCardProps = {
  readonly memorySweepState: MemoryRunState | null;
  readonly memorySweepBusy: boolean;
  readonly memorySweepCanRun: boolean;
  readonly memorySweepRevision: number;
  readonly schedulerStore: ScheduledJobStore;
  onRunMemorySweep(): Promise<void>;
};

const RUN_HISTORY_LIMIT = 5;

const formatTimestamp = (value: string | null): string => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const describeSweepStatus = (state: MemoryRunState | null): string => {
  if (!state) return 'Never run';
  switch (state.status) {
    case 'running':
      return 'Running…';
    case 'failed':
      return 'Last run failed';
    case 'idle':
      return state.lastCompletedAt ? 'Idle' : 'Never run';
  }
};

const describeRunStatus = (run: ScheduledJobRun): string => {
  switch (run.status) {
    case 'success':
      return 'Succeeded';
    case 'error':
      return 'Failed';
    case 'skipped':
      return `Skipped${run.skippedCount > 1 ? ` ×${run.skippedCount}` : ''}`;
  }
};

export const MemorySweepDiagnosticsCard = ({
  memorySweepState,
  memorySweepBusy,
  memorySweepCanRun,
  memorySweepRevision,
  schedulerStore,
  onRunMemorySweep,
}: MemorySweepDiagnosticsCardProps): JSX.Element => {
  const [runs, setRuns] = useState<readonly ScheduledJobRun[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const next = await schedulerStore.listRuns(SYSTEM_DAILY_MEMORY_SWEEP_JOB_ID, RUN_HISTORY_LIMIT);
        if (active) {
          setRuns(next);
          setHistoryError(null);
        }
      } catch (error) {
        if (active) {
          setHistoryError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [schedulerStore, memorySweepRevision]);

  const status = describeSweepStatus(memorySweepState);
  const lastCompleted = formatTimestamp(memorySweepState?.lastCompletedAt ?? null);
  const lastError = memorySweepState?.lastError ?? null;
  const runDisabled = memorySweepBusy || !memorySweepCanRun;

  return (
    <article className="tk-memory-settings__card tk-memory-sweep-diagnostics" aria-label="Memory sweep diagnostics">
      <div className="tk-memory-settings__row">
        <div className="tk-memory-settings__copy">
          <h3>Daily memory sweep</h3>
          <p>
            Runs every night at 04:00 host time. It re-indexes the vault, flags stale entities, and asks OpenCode to
            extract new facts from connected MCP tools.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            void onRunMemorySweep();
          }}
          disabled={runDisabled}
        >
          {memorySweepBusy ? 'Running…' : 'Run now'}
        </Button>
      </div>

      <dl className="tk-memory-sweep-diagnostics__stats">
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>Last completed</dt>
          <dd>{lastCompleted}</dd>
        </div>
      </dl>

      {lastError ? (
        <p className="tk-memory-sweep-diagnostics__error" role="alert">
          {lastError}
        </p>
      ) : null}

      {!memorySweepCanRun ? (
        <p className="tk-memory-settings__state">
          Connect a vault and a model to enable manual sweeps.
        </p>
      ) : null}

      <section className="tk-memory-sweep-diagnostics__history" aria-label="Recent memory sweep runs">
        <h4 className="tk-memory-sweep-diagnostics__history-title">Recent runs</h4>
        {historyError ? (
          <p className="tk-memory-sweep-diagnostics__error" role="alert">
            Failed to read run history: {historyError}
          </p>
        ) : runs.length === 0 ? (
          <p className="tk-memory-settings__state">No runs yet.</p>
        ) : (
          <ul className="tk-memory-sweep-diagnostics__history-list">
            {runs.map((run) => (
              <li key={run.id} className={`tk-memory-sweep-diagnostics__history-item tk-memory-sweep-diagnostics__history-item--${run.status}`}>
                <span className="tk-memory-sweep-diagnostics__history-status">{describeRunStatus(run)}</span>
                <span className="tk-memory-sweep-diagnostics__history-time">{formatTimestamp(run.finishedAt)}</span>
                {run.errorText ? (
                  <span className="tk-memory-sweep-diagnostics__history-detail">{run.errorText}</span>
                ) : run.outputText ? (
                  <span className="tk-memory-sweep-diagnostics__history-detail">{run.outputText}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
};
