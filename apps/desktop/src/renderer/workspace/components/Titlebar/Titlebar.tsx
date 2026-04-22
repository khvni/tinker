import type { JSX } from 'react';
import { IconButton } from '@tinker/design';
import { getPanelTitleForPath } from '../../../renderers/file-utils.js';
import './Titlebar.css';

export type TitlebarProps = {
  sessionFolderPath: string | null;
  isLeftRailVisible: boolean;
  isRightInspectorVisible: boolean;
  onToggleLeftRail: () => void;
  onToggleRightInspector: () => void;
  onOpenPlaybook?: () => void;
};

const basename = (path: string): string => getPanelTitleForPath(path.replace(/[\\/]+$/u, ''));

// Paper 9Q-0: 15×15 glyph with 12×10 rounded-rect panel outline + a divider line.
// LEFT-rail-toggle places the divider toward the left edge of the panel. Stroke uses
// currentColor so the wrapping IconButton's text-token color drives fill at rest/hover.
const LeftPaneToggleIcon = (): JSX.Element => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <line x1="6" y1="2.5" x2="6" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

// RIGHT-inspector-toggle mirrors the left glyph with the divider biased right.
const RightPaneToggleIcon = (): JSX.Element => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <line x1="9.5" y1="2.5" x2="9.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const PlaybookIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5Z" />
    <path d="M7 5v14" />
    <path d="M9 9h5M9 12h5" />
  </svg>
);

export const Titlebar = ({
  sessionFolderPath,
  isLeftRailVisible,
  isRightInspectorVisible,
  onToggleLeftRail,
  onToggleRightInspector,
  onOpenPlaybook,
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
            <span className="tinker-titlebar__crumb" title={sessionFolderPath ?? undefined}>
              {crumb}
            </span>
          </>
        ) : null}
      </div>

      <div className="tinker-titlebar__actions" data-tauri-drag-region="false">
        <IconButton
          variant="ghost"
          size="s"
          icon={<LeftPaneToggleIcon />}
          label="Toggle left sidebar"
          aria-pressed={!isLeftRailVisible}
          onClick={onToggleLeftRail}
        />
        <IconButton
          variant="ghost"
          size="s"
          icon={<RightPaneToggleIcon />}
          label="Toggle right inspector"
          aria-pressed={!isRightInspectorVisible}
          onClick={onToggleRightInspector}
        />
        {onOpenPlaybook ? (
          <IconButton
            variant="ghost"
            size="s"
            icon={<PlaybookIcon />}
            label="Playbook"
            onClick={onOpenPlaybook}
          />
        ) : null}
      </div>
    </header>
  );
};
