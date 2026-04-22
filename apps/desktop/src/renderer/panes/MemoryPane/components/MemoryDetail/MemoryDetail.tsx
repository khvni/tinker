import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Badge, Button, EmptyState, IconButton, Textarea } from '@tinker/design';
import {
  PENDING_MEMORY_CATEGORY,
  type MemoryEntryBucket,
  type MemoryMarkdownFile,
} from '@tinker/memory';
import { renderMarkdown } from '../../../../renderers/MarkdownRenderer.js';
import './MemoryDetail.css';

export type MemoryDetailProps = {
  file: MemoryMarkdownFile | null;
  bucket: MemoryEntryBucket | null;
  diffText: string;
  diffLoading: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onSaved?: (filePath: string) => void;
  isBusy: boolean;
  allowEditing?: boolean;
  previewMarkdown?: string | null;
};

const RELATIVE_THRESHOLDS: ReadonlyArray<{ seconds: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { seconds: 60, unit: 'second' },
  { seconds: 3600, unit: 'minute' },
  { seconds: 86400, unit: 'hour' },
  { seconds: 2592000, unit: 'day' },
  { seconds: 31536000, unit: 'month' },
  { seconds: Number.POSITIVE_INFINITY, unit: 'year' },
];

const formatRelative = (value: string, formatter: Intl.RelativeTimeFormat): string => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const index = RELATIVE_THRESHOLDS.findIndex(({ seconds }) => absoluteSeconds < seconds);
  if (index === -1) {
    return 'unknown';
  }
  const threshold = RELATIVE_THRESHOLDS[index]!;
  const divisor = index === 0 ? 1 : RELATIVE_THRESHOLDS[index - 1]!.seconds;
  return formatter.format(Math.round(deltaSeconds / divisor), threshold.unit);
};

const PencilIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3 12.5L3 13.5h1l7-7-1-1-7 7zM10 5.5l1-1 1 1-1 1-1-1z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const CategoryBadge = ({ bucket }: { bucket: MemoryEntryBucket }): JSX.Element | null => {
  if (bucket === PENDING_MEMORY_CATEGORY) {
    return null;
  }
  return <Badge variant="default" size="medium">{bucket}</Badge>;
};

type StatusLineProps = {
  bucket: MemoryEntryBucket;
  modifiedAt: string;
  formatter: Intl.RelativeTimeFormat;
};

const StatusLine = ({ bucket, modifiedAt, formatter }: StatusLineProps): JSX.Element => {
  if (bucket === PENDING_MEMORY_CATEGORY) {
    return (
      <span className="tinker-memory-detail__status">
        <span className="tinker-memory-detail__status-dot" aria-hidden="true" />
        <span>Update · Pending review</span>
      </span>
    );
  }
  return (
    <span className="tinker-memory-detail__status">
      <span>Updated {formatRelative(modifiedAt, formatter)}</span>
    </span>
  );
};

type SectionProps = {
  label: string;
  children: ReactNode;
};

const DetailSection = ({ label, children }: SectionProps): JSX.Element => (
  <section className="tinker-memory-detail__section">
    <span className="tinker-memory-detail__section-label">{label}</span>
    {children}
  </section>
);

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; html: string; markdown: string }
  | { status: 'error'; message: string };

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Could not update this memory file.';
};

const useFilePreview = (file: MemoryMarkdownFile | null, previewMarkdown?: string | null): PreviewState => {
  const [state, setState] = useState<PreviewState>({ status: 'idle' });

  useEffect(() => {
    if (file === null) {
      setState({ status: 'idle' });
      return;
    }

    if (typeof previewMarkdown === 'string') {
      void (async () => {
        const rendered = await renderMarkdown(previewMarkdown);
        const safeHtml = DOMPurify.sanitize(rendered);
        setState({ status: 'ready', html: safeHtml, markdown: previewMarkdown });
      })();
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const text = await readTextFile(file.absolutePath);
        const rendered = await renderMarkdown(text);
        const safeHtml = DOMPurify.sanitize(rendered);
        if (cancelled) {
          return;
        }
        setState({ status: 'ready', html: safeHtml, markdown: text });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, previewMarkdown]);

  return state;
};

type MarkdownPreviewProps = {
  sanitizedHtml: string;
};

const MarkdownPreview = ({ sanitizedHtml }: MarkdownPreviewProps): JSX.Element => (
  <article
    className="tinker-memory-detail__preview tinker-markdown-body"
    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
  />
);

export const MemoryDetail = ({
  file,
  bucket,
  diffText,
  diffLoading,
  onApprove,
  onDismiss,
  onSaved,
  isBusy,
  allowEditing = true,
  previewMarkdown,
}: MemoryDetailProps): JSX.Element => {
  const relativeFormatter = useMemo(() => new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }), []);
  const preview = useFilePreview(file, previewMarkdown);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [draft, setDraft] = useState('');
  const [savedDraft, setSavedDraft] = useState('');
  const [optimisticPreview, setOptimisticPreview] = useState<Extract<PreviewState, { status: 'ready' }> | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMode('read');
    setSaveError(null);
    setOptimisticPreview(null);
  }, [file?.absolutePath]);

  const effectivePreview = optimisticPreview ?? preview;

  useEffect(() => {
    if (effectivePreview.status !== 'ready') {
      return;
    }

    setSavedDraft(effectivePreview.markdown);
    if (mode === 'read') {
      setDraft(effectivePreview.markdown);
    }
  }, [effectivePreview, mode]);

  useEffect(() => {
    if (optimisticPreview === null || preview.status !== 'ready') {
      return;
    }

    if (preview.markdown === optimisticPreview.markdown) {
      setOptimisticPreview(null);
    }
  }, [optimisticPreview, preview]);

  if (file === null || bucket === null) {
    return (
      <div className="tinker-memory-detail tinker-memory-detail--empty">
        <EmptyState
          title="Select a memory entry"
          description="Pick an item from the sidebar to preview its content and changes."
        />
      </div>
    );
  }

  const showActions = bucket === PENDING_MEMORY_CATEGORY;
  const controlsBusy = isBusy || isSaving;
  const isEditing = mode === 'edit';
  const isDirty = draft !== savedDraft;
  const canStartEditing = allowEditing && effectivePreview.status === 'ready' && !controlsBusy;
  const diffEmpty = !diffLoading && diffText.trim().length === 0;

  const handleSave = async (): Promise<void> => {
    if (file === null || !allowEditing || isSaving) {
      return;
    }

    if (!isDirty) {
      setMode('read');
      setSaveError(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await writeTextFile(file.absolutePath, draft);
      const rendered = await renderMarkdown(draft);
      const safeHtml = DOMPurify.sanitize(rendered);
      const nextPreview: Extract<PreviewState, { status: 'ready' }> = {
        status: 'ready',
        html: safeHtml,
        markdown: draft,
      };

      setSavedDraft(draft);
      setOptimisticPreview(nextPreview);
      setMode('read');
      onSaved?.(file.absolutePath);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="tinker-memory-detail">
      <header className="tinker-memory-detail__header">
        <div className="tinker-memory-detail__header-main">
          <div className="tinker-memory-detail__title-row">
            <h2 className="tinker-memory-detail__title">{file.name}</h2>
            {bucket !== PENDING_MEMORY_CATEGORY ? <CategoryBadge bucket={bucket} /> : null}
          </div>
          <StatusLine bucket={bucket} modifiedAt={file.modifiedAt} formatter={relativeFormatter} />
        </div>
        {showActions ? (
          <div className="tinker-memory-detail__actions">
            <Button variant="primary" size="m" disabled={controlsBusy || isEditing} onClick={onApprove}>
              Approve
            </Button>
            <Button variant="secondary" size="m" disabled={controlsBusy || isEditing} onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        ) : null}
      </header>

      <div className="tinker-memory-detail__body">
        <DetailSection label="Content">
          <div className="tinker-memory-detail__file-card">
            <div className="tinker-memory-detail__file-card-header">
              <div className="tinker-memory-detail__file-card-titles">
                <span className="tinker-memory-detail__file-name">{file.name}</span>
                <span className="tinker-memory-detail__file-path">{file.absolutePath}</span>
              </div>
              <div className="tinker-memory-detail__file-card-actions">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="s"
                      disabled={controlsBusy}
                      onClick={() => {
                        setDraft(savedDraft);
                        setSaveError(null);
                        setMode('read');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button variant="primary" size="s" disabled={controlsBusy} onClick={() => void handleSave()}>
                      Save
                    </Button>
                  </>
                ) : (
                  <IconButton
                    size="s"
                    variant="ghost"
                    label="Edit"
                    icon={<PencilIcon />}
                    disabled={!canStartEditing}
                    onClick={() => {
                      setDraft(savedDraft);
                      setSaveError(null);
                      setMode('edit');
                    }}
                  />
                )}
              </div>
            </div>
            <div className="tinker-memory-detail__file-card-body">
              {saveError ? <p className="tinker-memory-detail__muted">{saveError}</p> : null}
              {effectivePreview.status === 'loading' ? (
                <p className="tinker-memory-detail__muted">Loading preview…</p>
              ) : null}
              {effectivePreview.status === 'error' ? (
                <p className="tinker-memory-detail__muted">Could not load file: {effectivePreview.message}</p>
              ) : null}
              {effectivePreview.status === 'ready' && isEditing ? (
                <Textarea
                  className="tinker-memory-detail__editor"
                  resize="none"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.currentTarget.value);
                    setSaveError(null);
                  }}
                  spellCheck={false}
                  placeholder="Write your note in Markdown."
                />
              ) : null}
              {effectivePreview.status === 'ready' && !isEditing ? (
                <MarkdownPreview sanitizedHtml={effectivePreview.html} />
              ) : null}
            </div>
            <div className="tinker-memory-detail__file-card-footer">
              <span className="tinker-memory-detail__footer-eyebrow">Markdown</span>
              <span className="tinker-memory-detail__footer-dot" aria-hidden="true" />
              <span className="tinker-memory-detail__footer-mode">
                {isSaving ? 'Saving…' : isEditing ? 'Edit mode' : 'Read mode'}
              </span>
            </div>
          </div>
        </DetailSection>

        <DetailSection label="Changes">
          <div className="tinker-memory-detail__diff-card">
            {diffLoading ? (
              <p className="tinker-memory-detail__muted">Loading diff…</p>
            ) : diffEmpty ? (
              <p className="tinker-memory-detail__muted">No previous version on disk.</p>
            ) : (
              <pre className="tinker-memory-detail__diff">{diffText}</pre>
            )}
          </div>
        </DetailSection>
      </div>
    </div>
  );
};
