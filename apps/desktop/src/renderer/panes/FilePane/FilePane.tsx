import { type ComponentProps, type JSX } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import type { IDockviewPanelProps } from 'dockview-react';
import { CodeRenderer } from '../../renderers/CodeRenderer.js';
import { CsvRenderer } from '../../renderers/CsvRenderer.js';
import { HtmlRenderer } from '../../renderers/HtmlRenderer.js';
import { ImageRenderer } from '../../renderers/ImageRenderer.js';
import { MarkdownEditor } from '../../renderers/MarkdownEditor.js';
import { MarkdownRenderer } from '../../renderers/MarkdownRenderer.js';
import { getPanelIdForPath, type FilePaneParams } from '../../renderers/file-utils.js';
import { ExternalPreviewPane } from './components/ExternalPreviewPane/index.js';

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
  ...createMimeMap(PPTX_MIME_TYPES, PptxFileRenderer),
  'application/xhtml+xml': HtmlFileRenderer,
  'text/csv': CsvFileRenderer,
  'text/html': HtmlFileRenderer,
  'text/markdown': MarkdownFileRenderer,
  [MARKDOWN_EDITOR_MIME]: MarkdownEditorFileRenderer,
  'text/x-markdown': MarkdownFileRenderer,
});

export { openFileExternally } from './components/ExternalPreviewPane/index.js';

export const FilePane = ({ data, vaultRevision = 0 }: FilePaneProps): JSX.Element => {
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
