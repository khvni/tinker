import { useEffect, useState, type JSX } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import type { IDockviewPanelProps } from 'dockview-react';
import { getImageMimeType, getPanelTitleForPath, type FilePaneParams } from './file-utils.js';

export const ImageRenderer = ({ params }: IDockviewPanelProps<FilePaneParams>): JSX.Element => {
  const path = params?.path;
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing image file path.');
      setSrc(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        setError(null);
        const bytes = await readFile(path);
        const blob = new Blob([bytes], { type: getImageMimeType(path) });
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setSrc(objectUrl);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setSrc(null);
        }
      }
    })();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Image</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled image'}</h2>
        </div>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {!error && src ? <img className="tinker-image-preview" src={src} alt={path ?? 'Image preview'} /> : null}
    </section>
  );
};
