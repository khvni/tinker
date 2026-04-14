import { useEffect, useState, type JSX } from 'react';
import type { Entity, MemoryStore } from '@tinker/shared-types';

type TodayProps = {
  memoryStore: MemoryStore;
  vaultPath: string | null;
  vaultRevision: number;
};

export const Today = ({ memoryStore, vaultPath, vaultRevision }: TodayProps): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const nextEntities = await memoryStore.recentEntities(8);
      if (active) {
        setEntities(nextEntities);
      }
    })();

    return () => {
      active = false;
    };
  }, [memoryStore, vaultPath, vaultRevision]);

  return (
    <section className="tinker-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Today</p>
          <h2>Recent local memory</h2>
        </div>
        <span className="tinker-pill">{vaultPath ? 'Vault connected' : 'No vault yet'}</span>
      </header>

      <div className="tinker-list">
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
