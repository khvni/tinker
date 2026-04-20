import { useEffect, useState, type JSX } from 'react';
import { Badge, Button } from '@tinker/design';
import type { MemoryRunState } from '@tinker/memory';
import type { Entity, MemoryStore, ScheduledJobStore, ScheduledTodayEntry } from '@tinker/shared-types';

type TodayProps = {
  memoryStore: MemoryStore;
  schedulerStore: ScheduledJobStore;
  vaultPath: string | null;
  vaultRevision: number;
  schedulerRevision: number;
  memorySweepState: MemoryRunState | null;
  memorySweepBusy: boolean;
  onRunMemorySweep(): Promise<void>;
};

const formatSweepStatus = (state: MemoryRunState | null): string => {
  if (!state) {
    return 'Sweep status unavailable';
  }

  if (state.status === 'running') {
    return 'Daily sweep running';
  }

  if (state.status === 'failed') {
    return state.lastError ? `Sweep failed: ${state.lastError}` : 'Sweep failed';
  }

  if (!state.lastCompletedAt) {
    return 'Daily sweep not run yet';
  }

  return `Last sweep ${new Date(state.lastCompletedAt).toLocaleString()}`;
};

export const Today = ({
  memoryStore,
  schedulerStore,
  vaultPath,
  vaultRevision,
  schedulerRevision,
  memorySweepState,
  memorySweepBusy,
  onRunMemorySweep,
}: TodayProps): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [scheduledEntries, setScheduledEntries] = useState<ScheduledTodayEntry[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [nextEntities, nextEntries] = await Promise.all([
        memoryStore.recentEntities(8),
        schedulerStore.listTodayEntries(4),
      ]);
      if (active) {
        setEntities(nextEntities);
        setScheduledEntries(nextEntries);
      }
    })();

    return () => {
      active = false;
    };
  }, [memoryStore, schedulerStore, vaultPath, vaultRevision, schedulerRevision]);

  return (
    <section className="tinker-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Today</p>
          <h2>Recent local memory</h2>
          <p className="tinker-muted">{formatSweepStatus(memorySweepState)}</p>
        </div>
        <div className="tinker-inline-actions">
          <Badge variant={vaultPath ? 'success' : 'default'} size="small">
            {vaultPath ? 'Vault connected' : 'No vault yet'}
          </Badge>
          <Button
            variant="ghost"
            size="s"
            onClick={() => {
              void onRunMemorySweep();
            }}
            disabled={!vaultPath || memorySweepBusy}
          >
            {memorySweepBusy ? 'Sweeping…' : 'Run memory sweep'}
          </Button>
        </div>
      </header>

      <div className="tinker-list">
        {scheduledEntries.length > 0 ? (
          <>
            <article className="tinker-list-item">
              <h3>Scheduled outputs</h3>
              <p className="tinker-muted">Latest jobs routed into Today.</p>
            </article>

            {scheduledEntries.map((entry) => (
              <article key={entry.runId} className="tinker-list-item">
                <h3>{entry.jobName}</h3>
                <p className="tinker-muted">
                  {entry.section} • {new Date(entry.finishedAt).toLocaleString()}
                </p>
                <p className="tinker-today-output">{entry.outputText}</p>
              </article>
            ))}
          </>
        ) : null}

        {entities.length === 0 ? (
          <div className="tinker-list-item">
            <h3>No indexed notes yet</h3>
            <p className="tinker-muted">
              Connect a vault or create the default one. Tinker will surface recent notes and entities here.
            </p>
          </div>
        ) : null}

        {entities.map((entity) => (
          <article key={entity.id} className="tinker-list-item">
            <h3>{entity.name}</h3>
            <p className="tinker-muted">
              {entity.kind} • {new Date(entity.lastSeenAt).toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
