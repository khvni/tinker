import { useState, type ComponentProps, type JSX } from 'react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { Button } from '@tinker/design';
import type { TinkerPaneData } from '@tinker/shared-types';
import type { IDockviewPanelProps } from 'dockview-react';
import { CodeRenderer } from '../../renderers/CodeRenderer.js';
import { CsvRenderer } from '../../renderers/CsvRenderer.js';
import { HtmlRenderer } from '../../renderers/HtmlRenderer.js';
import { ImageRenderer } from '../../renderers/ImageRenderer.js';
import { MarkdownEditor } from '../../renderers/MarkdownEditor.js';
import { MarkdownRenderer } from '../../renderers/MarkdownRenderer.js';
import { getPanelIdForPath, getPanelTitleForPath, type FilePaneParams } from '../../renderers/file-utils.js';

type FilePaneData = Extract<TinkerPaneData, { readonly kind: 'file' }>;

export type FilePaneProps = {
  data: FilePaneData;
  vaultRevision?: number;
};

type FileRendererProps = {
  path: string;
  mime: string;
  vaultRevision: number;
};

type FileRenderer = (props: FileRendererProps) => JSX.Element;

const createDockviewProps = (path: string, mime: string): IDockviewPanelProps<FilePaneParams> => {
  // Legacy file renderers still consume Dockview props. Keep the adapter
  // contained here until M1.7/M3 retire that contract.
  return { params: { path, mime } } as unknown as IDockviewPanelProps<FilePaneParams>;
};

const CodeFileRenderer: FileRenderer = ({ path, mime }) => {
  return <CodeRenderer {...createDockviewProps(path, mime)} />;
};

const CsvFileRenderer: FileRenderer = ({ path, mime }) => {
  return <CsvRenderer {...createDockviewProps(path, mime)} />;
};

const HtmlFileRenderer: FileRenderer = ({ path, mime }) => {
  return <HtmlRenderer {...createDockviewProps(path, mime)} />;
};

const ImageFileRenderer: FileRenderer = ({ path, mime }) => {
  return <ImageRenderer {...createDockviewProps(path, mime)} />;
};

const MarkdownFileRenderer: FileRenderer = ({ path, mime, vaultRevision }) => {
  const props = {
    ...createDockviewProps(path, mime),
    api: { id: getPanelIdForPath('file', path) } as ComponentProps<typeof MarkdownRenderer>['api'],
    vaultRevision,
  } as ComponentProps<typeof MarkdownRenderer>;

  return <MarkdownRenderer {...props} />;
};

const MarkdownEditorFileRenderer: FileRenderer = ({ path, mime, vaultRevision }) => {
  const props = {
    ...createDockviewProps(path, mime),
    vaultRevision,
  } as ComponentProps<typeof MarkdownEditor>;

  return <MarkdownEditor {...props} />;
};

const createMimeMap = (
  mimeTypes: readonly string[],
  renderer: FileRenderer,
): Record<string, FileRenderer> => {
  const entries: Record<string, FileRenderer> = {};

  for (const mime of mimeTypes) {
    entries[mime] = renderer;
  }

  return entries;
};

const CODE_MIME_TYPES = [
  'application/javascript',
  'application/json',
  'application/typescript',
  'application/xml',
  'text/javascript',
  'text/plain',
  'text/typescript',
  'text/x-python',
  'text/x-rust',
  'text/x-shellscript',
  'text/xml',
] as const;

const IMAGE_MIME_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
] as const;

// Legacy Markdown editor is still pane-based, so it needs a temporary
// MIME-shaped selector until M3 replaces the edit flow.
export const MARKDOWN_EDITOR_MIME = 'text/markdown; mode=edit';

export const mimeToRenderer: Readonly<Record<string, FileRenderer>> = Object.freeze({
  ...createMimeMap(CODE_MIME_TYPES, CodeFileRenderer),
  ...createMimeMap(IMAGE_MIME_TYPES, ImageFileRenderer),
  'application/xhtml+xml': HtmlFileRenderer,
  'text/csv': CsvFileRenderer,
  'text/html': HtmlFileRenderer,
  'text/markdown': MarkdownFileRenderer,
  [MARKDOWN_EDITOR_MIME]: MarkdownEditorFileRenderer,
  'text/x-markdown': MarkdownFileRenderer,
});

type UnsupportedFilePaneProps = {
  path: string;
  mime: string;
};

export const openFileExternally = async (path: string): Promise<void> => {
  await openExternal(path);
};

const UnsupportedFilePane = ({ path, mime }: UnsupportedFilePaneProps): JSX.Element => {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const handleOpenExternal = async (): Promise<void> => {
    setOpening(true);
    setError(null);

    try {
      await openFileExternally(path);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Unsupported file</p>
          <h2>{getPanelTitleForPath(path)}</h2>
        </div>
      </header>

      <p className="tinker-muted">Unsupported, open externally.</p>
      <p className="tinker-muted">MIME: {mime}</p>
      {error ? <p className="tinker-muted">{error}</p> : null}
      <div className="tinker-inline-actions">
        <Button
          variant="secondary"
          size="s"
          onClick={() => void handleOpenExternal()}
          disabled={opening}
        >
          {opening ? 'Opening…' : 'Open externally'}
        </Button>
      </div>
    </section>
  );
};

export const FilePane = ({ data, vaultRevision = 0 }: FilePaneProps): JSX.Element => {
  const Renderer = mimeToRenderer[data.mime];

  if (!Renderer) {
    return <UnsupportedFilePane path={data.path} mime={data.mime} />;
  }

  return <Renderer path={data.path} mime={data.mime} vaultRevision={vaultRevision} />;
};
