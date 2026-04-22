import { useEffect, useRef, useState, type JSX } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { getImageMimeType, getPanelTitleForPath } from './file-utils.js';

export type ImageRendererProps = {
  path: string;
};

export const ImageRenderer = ({ path }: ImageRendererProps): JSX.Element => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const revokeObjectUrl = (value: string | null): void => {
      if (value) {
        URL.revokeObjectURL(value);
      }
    };

    void (async () => {
      try {
        setError(null);
        const bytes = await readFile(path);
        const blob = new Blob([bytes], { type: getImageMimeType(path) });
        const nextObjectUrl = URL.createObjectURL(blob);

        if (!active) {
          revokeObjectUrl(nextObjectUrl);
          return;
        }

        const previousObjectUrl = objectUrlRef.current;
        objectUrlRef.current = nextObjectUrl;
        setSrc(nextObjectUrl);
        revokeObjectUrl(previousObjectUrl);
      } catch (nextError) {
        if (active) {
          if (objectUrlRef.current) {
            revokeObjectUrl(objectUrlRef.current);
            objectUrlRef.current = null;
          }
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setSrc(null);
        }
      }
    })();

    return () => {
      active = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [path]);

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Image</p>
          <h2>{getPanelTitleForPath(path)}</h2>
        </div>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {!error && src ? <img className="tinker-image-preview" src={src} alt={path} /> : null}
    </section>
  );
};
