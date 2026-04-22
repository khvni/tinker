import type { JSX } from 'react';
import { IconButton } from '@tinker/design';
import { getPanelTitleForPath } from '../../../renderers/file-utils.js';
import './Titlebar.css';

export type TitlebarProps = {
  sessionFolderPath: string | null;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
};

const basename = (path: string): string => getPanelTitleForPath(path.replace(/[\\/]+$/u, ''));

const PlusIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const BookIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5V4.5Z" />
    <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19" />
  </svg>
);

const SettingsIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.5 12a7.5 7.5 0 0 0-.12-1.32l2-1.55-2-3.46-2.36.94a7.5 7.5 0 0 0-2.28-1.32L14.4 3h-4.8l-.34 2.29a7.5 7.5 0 0 0-2.28 1.32l-2.36-.94-2 3.46 2 1.55a7.5 7.5 0 0 0 0 2.64l-2 1.55 2 3.46 2.36-.94a7.5 7.5 0 0 0 2.28 1.32L9.6 21h4.8l.34-2.29a7.5 7.5 0 0 0 2.28-1.32l2.36.94 2-3.46-2-1.55c.08-.43.12-.87.12-1.32Z" />
  </svg>
);

export const Titlebar = ({
  sessionFolderPath,
  onNewSession,
  onOpenSettings,
  onOpenMemory,
}: TitlebarProps): JSX.Element => {
  const crumb = sessionFolderPath !== null ? basename(sessionFolderPath) : null;

  return (
    <header className="tinker-titlebar" data-tauri-drag-region>
      <div className="tinker-titlebar__spacer" aria-hidden="true" />

      <div className="tinker-titlebar__center">
        <span className="tinker-titlebar__brand">Tinker</span>
        {crumb !== null ? (
          <>
            <span className="tinker-titlebar__sep" aria-hidden="true">
              ·
            </span>
            <span className="tinker-titlebar__crumb">{crumb}</span>
          </>
        ) : null}
      </div>

      <div className="tinker-titlebar__actions" data-tauri-drag-region="false">
        <IconButton
          variant="ghost"
          size="s"
          icon={<PlusIcon />}
          label="New chat"
          onClick={onNewSession}
        />
        <IconButton
          variant="ghost"
          size="s"
          icon={<BookIcon />}
          label="Memory"
          onClick={onOpenMemory}
        />
        <IconButton
          variant="ghost"
          size="s"
          icon={<SettingsIcon />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>
    </header>
  );
};
