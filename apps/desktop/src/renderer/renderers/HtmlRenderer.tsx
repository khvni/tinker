import { useEffect, useState, type JSX } from 'react';
import DOMPurify from 'dompurify';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { getPanelTitleForPath, type FilePaneParams } from './file-utils.js';

export const HTML_PREVIEW_SANDBOX = 'allow-same-origin';

const SCRIPT_TAG_PATTERN = /<script\b/i;

export const htmlNeedsExternalOpenHint = (html: string): boolean => {
  return SCRIPT_TAG_PATTERN.test(html);
};

export const HtmlRenderer = ({ params }: { params?: FilePaneParams }): JSX.Element => {
  const path = params?.path;
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showExternalHint, setShowExternalHint] = useState(false);

  useEffect(() => {
    if (!path) {
      setError('Missing HTML file path.');
      setHtml('');
      setShowExternalHint(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        const text = await readTextFile(path);
        if (active) {
          const requiresExternalHint = htmlNeedsExternalOpenHint(text);
          if (requiresExternalHint) {
            console.warn(
              `[HtmlRenderer] ${path} includes script tags. Open externally for full interactivity.`,
            );
          }
          setShowExternalHint(requiresExternalHint);
          setHtml(DOMPurify.sanitize(text));
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setHtml('');
          setShowExternalHint(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [path]);

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">HTML preview</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled preview'}</h2>
        </div>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {showExternalHint ? <p className="tinker-muted">Open externally for full interactivity.</p> : null}
      {!error ? (
        <iframe
          className="tinker-preview-frame"
          sandbox={HTML_PREVIEW_SANDBOX}
          srcDoc={html}
          title={path ?? 'HTML preview'}
        />
      ) : null}
    </section>
  );
};
