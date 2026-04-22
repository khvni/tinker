import { useState, type JSX } from 'react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { Button } from '@tinker/design';
import { getPanelTitleForPath } from '../../../../renderers/file-utils.js';

export type ExternalPreviewPaneProps = {
  eyebrow: string;
  infoLines?: readonly string[];
  message: string;
  mime?: string;
  path: string;
};

export const openFileExternally = async (path: string): Promise<void> => {
  await openExternal(path);
};

export const ExternalPreviewPane = ({
  eyebrow,
  infoLines = [],
  message,
  mime,
  path,
}: ExternalPreviewPaneProps): JSX.Element => {
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
          <p className="tinker-eyebrow">{eyebrow}</p>
          <h2>{getPanelTitleForPath(path)}</h2>
        </div>
      </header>

      <p className="tinker-muted">{message}</p>
      {infoLines.map((line) => (
        <p key={line} className="tinker-muted">
          {line}
        </p>
      ))}
      {mime ? <p className="tinker-muted">MIME: {mime}</p> : null}
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
