import { type JSX } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { CodeRenderer } from '../../renderers/CodeRenderer.js';
import { CsvRenderer } from '../../renderers/CsvRenderer.js';
import { DocxRenderer } from '../../renderers/DocxRenderer/index.js';
import { HtmlRenderer } from '../../renderers/HtmlRenderer.js';
import { ImageRenderer } from '../../renderers/ImageRenderer.js';
import { MarkdownEditor } from '../../renderers/MarkdownEditor.js';
import { MarkdownRenderer } from '../../renderers/MarkdownRenderer.js';
import { getPanelTitleForPath, type FilePaneParams } from '../../renderers/file-utils.js';
import { ExternalPreviewPane } from './components/ExternalPreviewPane/index.js';
import { MISSING_FILE_MIME } from './file-mime.js';

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

const toParams = (path: string, mime: string): FilePaneParams => ({ path, mime });

const CodeFileRenderer: FileRenderer = ({ path, mime }) => {
  return <CodeRenderer params={toParams(path, mime)} />;
};

const CsvFileRenderer: FileRenderer = ({ path }) => {
  return <CsvRenderer path={path} />;
};

const HtmlFileRenderer: FileRenderer = ({ path, mime }) => {
  return <HtmlRenderer params={toParams(path, mime)} />;
};

const DocxFileRenderer: FileRenderer = ({ path }) => {
  return <DocxRenderer path={path} />;
};

const ImageFileRenderer: FileRenderer = ({ path }) => {
  return <ImageRenderer path={path} />;
};

const MarkdownFileRenderer: FileRenderer = ({ path, mime, vaultRevision }) => {
  return <MarkdownRenderer params={toParams(path, mime)} vaultRevision={vaultRevision} />;
};

const MarkdownEditorFileRenderer: FileRenderer = ({ path, vaultRevision }) => {
  return <MarkdownEditor path={path} vaultRevision={vaultRevision} />;
};

const PptxFileRenderer: FileRenderer = ({ path, mime }) => {
  return (
    <ExternalPreviewPane
      eyebrow="PPTX preview"
      message="Inline PowerPoint preview is unavailable. Open externally for full-fidelity slides."
      mime={mime}
      path={path}
    />
  );
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

const PPTX_MIME_TYPES = [
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

// Legacy Markdown editor is still pane-based, so it needs a temporary
// MIME-shaped selector until M3 replaces the edit flow.
export const MARKDOWN_EDITOR_MIME = 'text/markdown; mode=edit';

export const mimeToRenderer: Readonly<Record<string, FileRenderer>> = Object.freeze({
  ...createMimeMap(CODE_MIME_TYPES, CodeFileRenderer),
  ...createMimeMap(IMAGE_MIME_TYPES, ImageFileRenderer),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocxFileRenderer,
  ...createMimeMap(PPTX_MIME_TYPES, PptxFileRenderer),
  'application/xhtml+xml': HtmlFileRenderer,
  'text/csv': CsvFileRenderer,
  'text/html': HtmlFileRenderer,
  'text/markdown': MarkdownFileRenderer,
  [MARKDOWN_EDITOR_MIME]: MarkdownEditorFileRenderer,
  'text/x-markdown': MarkdownFileRenderer,
});

type MissingFilePaneProps = {
  path: string;
};

const MissingFilePane = ({ path }: MissingFilePaneProps): JSX.Element => {
  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">File unavailable</p>
          <h2>{getPanelTitleForPath(path)}</h2>
        </div>
      </header>

      <p className="tinker-muted">File no longer exists at this path.</p>
      <p className="tinker-muted">{path}</p>
    </section>
  );
};
export { openFileExternally } from './components/ExternalPreviewPane/index.js';

export const FilePane = ({ data, vaultRevision = 0 }: FilePaneProps): JSX.Element => {
  if (data.mime === MISSING_FILE_MIME) {
    return <MissingFilePane path={data.path} />;
  }

  const Renderer = mimeToRenderer[data.mime];

  if (!Renderer) {
    return (
      <ExternalPreviewPane
        eyebrow="Unsupported file"
        message="Unsupported, open externally."
        mime={data.mime}
        path={data.path}
      />
    );
  }

  return <Renderer path={data.path} mime={data.mime} vaultRevision={vaultRevision} />;
};
