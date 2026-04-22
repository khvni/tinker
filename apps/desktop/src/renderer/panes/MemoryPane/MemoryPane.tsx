import { useCallback, useEffect, useState, type JSX } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { EmptyState, Button } from '@tinker/design';
import {
  bucketForFrontmatter,
  listCategorisedMemoryFiles,
  MEMORY_CATEGORY_DIRECTORIES,
  parseFrontmatter,
  subscribeMemoryPathChanged,
  type CategorisedMemoryFiles,
  type MemoryEntryBucket,
  type MemoryMarkdownFile,
} from '@tinker/memory';
import { useFilePaneRuntime } from '../FilePane/file-pane-runtime.js';
import { useMemoryPaneRuntime } from '../../workspace/memory-pane-runtime.js';
import { MemorySidebar } from './components/MemorySidebar/index.js';
import { MemoryDetail } from './components/MemoryDetail/index.js';
import {
  approveMemoryEntry,
  dismissMemoryEntry,
  readMemoryDiff,
} from './memory-commands.js';
import { isTauriRuntime } from '../../runtime.js';
import {
  PREVIEW_MEMORY_BUCKETS,
  PREVIEW_MEMORY_DIFF,
  PREVIEW_MEMORY_MARKDOWN,
  PREVIEW_MEMORY_REFERENCE_TIME_MS,
  PREVIEW_MEMORY_SELECTION,
} from './memory-preview.js';
import './MemoryPane.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

const emptyBuckets = (): Record<MemoryEntryBucket, MemoryMarkdownFile[]> => ({
  pending: [],
  people: [],
  'active-work': [],
  capabilities: [],
  preferences: [],
  organization: [],
});

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Memory is unavailable right now.';
};

type Selection = {
  file: MemoryMarkdownFile;
  bucket: MemoryEntryBucket;
};

export const MemoryPane = (): JSX.Element => {
  const { currentUserId } = useMemoryPaneRuntime();
  const filePaneRuntime = useFilePaneRuntime();
  const nativeRuntime = isTauriRuntime();
  const browserPreview = !nativeRuntime && import.meta.env.VITE_E2E === '1';

  const [reloadToken, setReloadToken] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [categorised, setCategorised] = useState<CategorisedMemoryFiles>({
    rootPath: '',
    buckets: emptyBuckets(),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [seenPaths, setSeenPaths] = useState<ReadonlySet<string>>(new Set());
  const [diffText, setDiffText] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });

    if (browserPreview) {
      setCategorised({
        rootPath: '/memory/demo',
        buckets: PREVIEW_MEMORY_BUCKETS,
      });
      setSelection((current) => current ?? PREVIEW_MEMORY_SELECTION);
      setLoad({ status: 'ready' });
      return () => {
        cancelled = true;
      };
    }

    void listCategorisedMemoryFiles(currentUserId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setCategorised(result);
        setLoad({ status: 'ready' });

        setSelection((current) => {
          if (!current) {
            return null;
          }
          const stillExists = Object.values(result.buckets)
            .flat()
            .some((file) => file.absolutePath === current.file.absolutePath);
          return stillExists ? current : null;
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setCategorised({ rootPath: '', buckets: emptyBuckets() });
        setLoad({ status: 'error', message: toErrorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [browserPreview, currentUserId, reloadToken]);

  useEffect(() => {
    return subscribeMemoryPathChanged(() => {
      setReloadToken((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!selection) {
      setDiffText('');
      setDiffLoading(false);
      return;
    }

    if (browserPreview) {
      setDiffText(PREVIEW_MEMORY_DIFF[selection.file.absolutePath] ?? '');
      setDiffLoading(false);
      return;
    }

    let cancelled = false;
    setDiffLoading(true);
    void readMemoryDiff(selection.file.absolutePath)
      .then((text) => {
        if (!cancelled) {
          setDiffText(text);
          setDiffLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiffText('');
          setDiffLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [browserPreview, selection]);

  const reloadFiles = useCallback((): void => {
    setReloadToken((value) => value + 1);
  }, []);

  const handleSelect = useCallback(
    (file: MemoryMarkdownFile, bucket: MemoryEntryBucket): void => {
      setSelection({ file, bucket });
      setSeenPaths((current) => {
        if (current.has(file.absolutePath)) {
          return current;
        }
        const next = new Set(current);
        next.add(file.absolutePath);
        return next;
      });
      setActionError(null);
    },
    [],
  );

  const handleApprove = useCallback(async (): Promise<void> => {
    if (!selection || selection.bucket !== 'pending' || isBusy) {
      return;
    }
    if (browserPreview) {
      setActionError('Approve is unavailable in browser preview.');
      return;
    }
    setIsBusy(true);
    setActionError(null);
    try {
      const text = await readTextFile(selection.file.absolutePath);
      const { frontmatter } = parseFrontmatter(text);
      const categoryId = bucketForFrontmatter(frontmatter);
      if (!categoryId) {
        throw new Error(
          'Memory entry is missing a recognised "kind:" frontmatter (people, active-work, capabilities, preferences, organization).',
        );
      }
      await approveMemoryEntry(selection.file.absolutePath, MEMORY_CATEGORY_DIRECTORIES[categoryId]);
      setSelection(null);
      reloadFiles();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [browserPreview, isBusy, reloadFiles, selection]);

  const handleDismiss = useCallback(async (): Promise<void> => {
    if (!selection || selection.bucket !== 'pending' || isBusy) {
      return;
    }
    if (browserPreview) {
      setActionError('Dismiss is unavailable in browser preview.');
      return;
    }
    setIsBusy(true);
    setActionError(null);
    try {
      await dismissMemoryEntry(selection.file.absolutePath);
      setSelection(null);
      reloadFiles();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [browserPreview, isBusy, reloadFiles, selection]);

  const handleOpenInTab = useCallback(
    (file: MemoryMarkdownFile): void => {
      filePaneRuntime?.openFile(file.absolutePath, { mime: 'text/markdown' });
    },
    [filePaneRuntime],
  );

  if (load.status === 'error') {
    return (
      <div className="tinker-memory-pane tinker-memory-pane--error">
        <EmptyState
          align="start"
          title="Could not load memory"
          description={load.message}
          action={
            <Button variant="secondary" size="s" onClick={reloadFiles}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <section className="tinker-memory-pane" aria-label="Memory">
      <MemorySidebar
        buckets={categorised.buckets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedPath={selection?.file.absolutePath ?? null}
        onSelect={handleSelect}
        seenPaths={seenPaths}
        referenceTimeMs={browserPreview ? PREVIEW_MEMORY_REFERENCE_TIME_MS : undefined}
      />
      <div className="tinker-memory-pane__detail">
        {actionError ? (
          <div className="tinker-memory-pane__banner" role="alert">
            {actionError}
          </div>
        ) : null}
        <MemoryDetail
          file={selection?.file ?? null}
          bucket={selection?.bucket ?? null}
          diffText={diffText}
          diffLoading={diffLoading}
          onApprove={() => {
            void handleApprove();
          }}
          onDismiss={() => {
            void handleDismiss();
          }}
          onOpenInTab={handleOpenInTab}
          isBusy={isBusy}
          previewMarkdown={
            !browserPreview || !selection ? null : (PREVIEW_MEMORY_MARKDOWN[selection.file.absolutePath] ?? null)
          }
        />
      </div>
    </section>
  );
};
