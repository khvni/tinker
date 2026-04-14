import { useEffect, useState, type JSX } from 'react';
import DOMPurify from 'dompurify';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { IDockviewPanelProps } from 'dockview-react';
import { getPanelTitleForPath, type FilePaneParams } from './file-utils.js';

export const HtmlRenderer = ({ params }: IDockviewPanelProps<FilePaneParams>): JSX.Element => {
  const path = params?.path;
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing HTML file path.');
      setHtml('');
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        const text = await readTextFile(path);
        if (active) {
          setHtml(DOMPurify.sanitize(text));
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setHtml('');
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
      {!error ? <iframe className="tinker-preview-frame" sandbox="allow-scripts" srcDoc={html} title={path ?? 'HTML preview'} /> : null}
    </section>
  );
};
