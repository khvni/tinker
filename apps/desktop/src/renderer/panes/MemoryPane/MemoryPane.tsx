import { useEffect, useMemo, useState, type JSX } from 'react';
import { Badge, Button, EmptyState, Skeleton } from '@tinker/design';
import {
  listMemoryMarkdownFiles,
  subscribeMemoryPathChanged,
  type MemoryMarkdownFile,
} from '@tinker/memory';
import { useFilePaneRuntime } from '../FilePane/file-pane-runtime.js';
import { useMemoryPaneRuntime } from '../../workspace/memory-pane-runtime.js';
import './MemoryPane.css';

type MemoryPaneState =
  | {
      status: 'loading';
      files: MemoryMarkdownFile[];
      errorMessage: null;
    }
  | {
      status: 'ready';
      files: MemoryMarkdownFile[];
      errorMessage: null;
    }
  | {
      status: 'error';
      files: MemoryMarkdownFile[];
      errorMessage: string;
    };

const toErrorMessage = (error: unknown): string => {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Memory files are unavailable right now.';
};

const RELATIVE_THRESHOLDS: ReadonlyArray<{ seconds: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { seconds: 60, unit: 'second' },
  { seconds: 3600, unit: 'minute' },
  { seconds: 86400, unit: 'hour' },
  { seconds: 2592000, unit: 'day' },
  { seconds: 31536000, unit: 'month' },
  { seconds: Number.POSITIVE_INFINITY, unit: 'year' },
];

const formatRelative = (value: string, formatter: Intl.RelativeTimeFormat, now: number): string => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Updated · unknown';
  }

  const deltaSeconds = Math.round((timestamp - now) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const index = RELATIVE_THRESHOLDS.findIndex(({ seconds }) => absoluteSeconds < seconds);
  if (index === -1) {
    return 'Updated · unknown';
  }

  const threshold = RELATIVE_THRESHOLDS[index]!;
  const divisor = index === 0 ? 1 : RELATIVE_THRESHOLDS[index - 1]!.seconds;
  return `Updated · ${formatter.format(Math.round(deltaSeconds / divisor), threshold.unit)}`;
};

export const MemoryPane = (): JSX.Element => {
  const { currentUserId } = useMemoryPaneRuntime();
  const filePaneRuntime = useFilePaneRuntime();
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<MemoryPaneState>({
    status: 'loading',
    files: [],
    errorMessage: null,
  });
  const relativeFormatter = useMemo(() => {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  }, []);
  const nowMs = useMemo(() => Date.now(), [reloadToken]);

  useEffect(() => {
    let cancelled = false;

    setState((currentState) => ({
      status: 'loading',
      files: currentState.files,
      errorMessage: null,
    }));

    void listMemoryMarkdownFiles(currentUserId)
      .then((files) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'ready',
          files,
          errorMessage: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'error',
          files: [],
          errorMessage: toErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, reloadToken]);

  useEffect(() => {
    return subscribeMemoryPathChanged(() => {
      setReloadToken((currentValue) => currentValue + 1);
    });
  }, []);

  const reloadFiles = (): void => {
    setReloadToken((currentValue) => currentValue + 1);
  };

  const openFile = (file: MemoryMarkdownFile): void => {
    filePaneRuntime?.openFile(file.absolutePath, { mime: 'text/markdown' });
  };

  const fileCountLabel =
    state.status === 'loading' ? 'Loading…' : `${state.files.length} file${state.files.length === 1 ? '' : 's'}`;

  return (
    <section className="tinker-memory-pane">
      <header className="tinker-memory-pane__header">
        <h2 className="tinker-memory-pane__title">Memory files</h2>
        <Badge variant="default" size="small">
          {fileCountLabel}
        </Badge>
      </header>

      <div className="tinker-memory-pane__content">
        {state.status === 'loading' ? (
          <div className="tinker-memory-pane__loading" aria-label="Loading memory files">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={`memory-loading-${index}`}
                variant="rect"
                height={48}
                className="tinker-memory-pane__state"
              />
            ))}
          </div>
        ) : null}

        {state.status === 'error' ? (
          <EmptyState
            className="tinker-memory-pane__state"
            align="start"
            title="Could not load memory"
            description={state.errorMessage}
            action={
              <Button variant="secondary" size="s" onClick={reloadFiles}>
                Try again
              </Button>
            }
          />
        ) : null}

        {state.status === 'ready' && state.files.length === 0 ? (
          <EmptyState
            className="tinker-memory-pane__state"
            align="start"
            title="No memory yet"
            description="Session captures and handwritten notes will show up here as markdown files."
          />
        ) : null}

        {state.status === 'ready' && state.files.length > 0 ? (
          <ul className="tinker-memory-pane__list">
            {state.files.map((file) => (
              <li key={file.absolutePath}>
                <Button
                  variant="ghost"
                  className="tinker-memory-pane__file-button"
                  title={file.relativePath}
                  onClick={() => {
                    openFile(file);
                  }}
                >
                  <span className="tinker-memory-pane__file-title">{file.name}</span>
                  <span className="tinker-memory-pane__file-meta">
                    {formatRelative(file.modifiedAt, relativeFormatter, nowMs)}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};
