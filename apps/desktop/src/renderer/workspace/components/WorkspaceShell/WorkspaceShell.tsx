import type { JSX, ReactNode } from 'react';
import './WorkspaceShell.css';

export type WorkspaceShellProps = {
  readonly titlebar: ReactNode;
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
  readonly isLeftRailVisible?: boolean;
  readonly isRightInspectorVisible?: boolean;
  readonly inspector?: ReactNode;
};

export const WorkspaceShell = ({
  titlebar,
  sidebar,
  children,
  isLeftRailVisible = true,
  isRightInspectorVisible = false,
  inspector,
}: WorkspaceShellProps): JSX.Element => {
  return (
    <main className="tinker-workspace-shell">
      <div className="tinker-workspace-shell__titlebar">{titlebar}</div>
      <div className="tinker-workspace-shell__body">
        <div
          className="tinker-workspace-shell__sidebar"
          data-collapsed={!isLeftRailVisible}
        >
          {sidebar}
        </div>
        <div className="tinker-workspace-shell__content">{children}</div>
        {inspector !== undefined ? (
          <div
            className="tinker-workspace-shell__inspector"
            data-collapsed={!isRightInspectorVisible}
          >
            {inspector}
          </div>
        ) : null}
      </div>
    </main>
  );
};
