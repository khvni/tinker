import { useMemo, type JSX } from 'react';
import { Button, EmptyState } from '@tinker/design';
import type { Session } from '@tinker/shared-types';
import { getPanelTitleForPath, tildify } from '../../../renderers/file-utils.js';
import './SessionSwitcher.css';

type SessionSwitcherProps = {
  readonly sessions: readonly Session[];
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly homeDirPath?: string | null;
  readonly onSelectSession: (session: Session) => void;
  readonly onCreateSession: () => void;
  readonly onRetry: () => void;
};

const basename = (path: string): string => getPanelTitleForPath(path.replace(/[\\/]+$/u, ''));

const formatRelativeTime = (iso: string): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return 'Recently active';
  }

  const elapsed = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) {
    return 'Just now';
  }
  if (elapsed < hour) {
    const minutes = Math.max(1, Math.round(elapsed / minute));
    return `${minutes}m ago`;
  }
  if (elapsed < day) {
    const hours = Math.max(1, Math.round(elapsed / hour));
    return `${hours}h ago`;
  }

  const days = Math.max(1, Math.round(elapsed / day));
  return `${days}d ago`;
};

export const SessionSwitcher = ({
  sessions,
  busy,
  errorMessage,
  homeDirPath = null,
  onSelectSession,
  onCreateSession,
  onRetry,
}: SessionSwitcherProps): JSX.Element => {
  const sortedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt)),
    [sessions],
  );

  if (errorMessage !== null) {
    return (
      <section className="tinker-session-switcher tinker-session-switcher--empty">
        <EmptyState
          title="Sessions unavailable"
          description={errorMessage}
          action={<Button onClick={onRetry}>Retry</Button>}
        />
      </section>
    );
  }

  if (sortedSessions.length === 0) {
    return (
      <section className="tinker-session-switcher tinker-session-switcher--empty">
        <EmptyState
          title="Choose a folder to start"
          description="Tinker starts each chat in a local folder and remembers it for this account."
          action={
            <Button onClick={onCreateSession} disabled={busy}>
              {busy ? 'Opening…' : 'Select folder'}
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="tinker-session-switcher" aria-labelledby="session-switcher-title">
      <div className="tinker-session-switcher__panel">
        <header className="tinker-session-switcher__header">
          <div>
            <p className="tinker-session-switcher__eyebrow">Sessions</p>
            <h1 id="session-switcher-title">Pick up where you left off</h1>
            <p className="tinker-session-switcher__subtitle">
              Recent folders for this account are listed newest first.
            </p>
          </div>
          <Button onClick={onCreateSession} disabled={busy}>
            {busy ? 'Opening…' : 'New session'}
          </Button>
        </header>

        <div className="tinker-session-switcher__list" aria-label="Recent sessions">
          {sortedSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="tinker-session-switcher__row"
              title={session.folderPath}
              disabled={busy}
              onClick={() => onSelectSession(session)}
            >
              <span className="tinker-session-switcher__folder">{basename(session.folderPath)}</span>
              <span className="tinker-session-switcher__path">
                {tildify(session.folderPath, homeDirPath)}
              </span>
              <span className="tinker-session-switcher__time">{formatRelativeTime(session.lastActiveAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
