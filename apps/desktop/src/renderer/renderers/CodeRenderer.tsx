import { useEffect, useState, type JSX } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { IDockviewPanelProps } from 'dockview-react';
import { getCodeLanguage, getPanelTitleForPath, type FilePaneParams } from './file-utils.js';

export const CodeRenderer = ({ params }: IDockviewPanelProps<FilePaneParams>): JSX.Element => {
  const path = params?.path;
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing file path.');
      setContent('');
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        const text = await readTextFile(path);
        if (active) {
          setContent(text);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setContent('');
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
          <p className="tinker-eyebrow">Code</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled file'}</h2>
        </div>
        {path ? <span className="tinker-pill">{getCodeLanguage(path)}</span> : null}
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {!error ? (
        <pre className="tinker-code-block">
          <code className={`language-${path ? getCodeLanguage(path) : 'plaintext'}`}>{content}</code>
        </pre>
      ) : null}
    </section>
  );
};
