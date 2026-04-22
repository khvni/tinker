import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { Badge, Button, EmptyState, IconButton } from '@tinker/design';
import {
  MEMORY_CATEGORY_LABELS,
  type MemoryCategoryId,
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
  onOpenInTab?: (file: MemoryMarkdownFile) => void;
  isBusy: boolean;
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

const FolderIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

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
  if (bucket === 'pending') {
    return null;
  }
  const label = MEMORY_CATEGORY_LABELS[bucket as MemoryCategoryId];
  return <Badge variant="default" size="medium">{label}</Badge>;
};

type StatusLineProps = {
  bucket: MemoryEntryBucket;
  modifiedAt: string;
  formatter: Intl.RelativeTimeFormat;
};

const StatusLine = ({ bucket, modifiedAt, formatter }: StatusLineProps): JSX.Element => {
  if (bucket === 'pending') {
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
  | { status: 'ready'; html: string }
  | { status: 'error'; message: string };

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
        setState({ status: 'ready', html: safeHtml });
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
        setState({ status: 'ready', html: safeHtml });
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
  onOpenInTab,
  isBusy,
  previewMarkdown,
}: MemoryDetailProps): JSX.Element => {
  const relativeFormatter = useMemo(() => new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }), []);
  const preview = useFilePreview(file, previewMarkdown);

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

  const showActions = bucket === 'pending';
  const diffEmpty = !diffLoading && diffText.trim().length === 0;

  return (
    <div className="tinker-memory-detail">
      <header className="tinker-memory-detail__header">
        <div className="tinker-memory-detail__header-main">
          <div className="tinker-memory-detail__title-row">
            <h2 className="tinker-memory-detail__title">{file.name}</h2>
            {bucket !== 'pending' ? <CategoryBadge bucket={bucket} /> : null}
          </div>
          <StatusLine bucket={bucket} modifiedAt={file.modifiedAt} formatter={relativeFormatter} />
        </div>
        {showActions ? (
          <div className="tinker-memory-detail__actions">
            <Button variant="primary" size="m" disabled={isBusy} onClick={onApprove}>
              Approve
            </Button>
            <Button variant="secondary" size="m" disabled={isBusy} onClick={onDismiss}>
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
                <IconButton
                  size="s"
                  variant="ghost"
                  label="Open as tab"
                  icon={<FolderIcon />}
                  onClick={() => {
                    onOpenInTab?.(file);
                  }}
                />
                <IconButton
                  size="s"
                  variant="ghost"
                  label="Edit (coming soon)"
                  icon={<PencilIcon />}
                  disabled
                />
              </div>
            </div>
            <div className="tinker-memory-detail__file-card-body">
              {preview.status === 'loading' ? (
                <p className="tinker-memory-detail__muted">Loading preview…</p>
              ) : null}
              {preview.status === 'error' ? (
                <p className="tinker-memory-detail__muted">Could not load file: {preview.message}</p>
              ) : null}
              {preview.status === 'ready' ? <MarkdownPreview sanitizedHtml={preview.html} /> : null}
            </div>
            <div className="tinker-memory-detail__file-card-footer">
              <span className="tinker-memory-detail__footer-eyebrow">Markdown</span>
              <span className="tinker-memory-detail__footer-dot" aria-hidden="true" />
              <span className="tinker-memory-detail__footer-mode">Read mode</span>
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
