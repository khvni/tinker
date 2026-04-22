import type { JSX } from 'react';
import { LeftPaneIcon, RightPaneIcon } from '../WorkspaceSidebar/icons.js';
import './Titlebar.css';

export type TitlebarProps = {
  readonly title: string;
};

export const Titlebar = ({ title }: TitlebarProps): JSX.Element => {
  return (
    <header className="tinker-titlebar" data-tauri-drag-region>
      <div className="tinker-titlebar__traffic-spacer" aria-hidden="true" />
      <div className="tinker-titlebar__title" data-tauri-drag-region>
        {title}
      </div>
      <div className="tinker-titlebar__actions">
        <button type="button" className="tinker-titlebar__action" aria-label="Toggle left panel" disabled>
          <LeftPaneIcon />
        </button>
        <button type="button" className="tinker-titlebar__action" aria-label="Toggle right panel" disabled>
          <RightPaneIcon />
        </button>
      </div>
    </header>
  );
};
