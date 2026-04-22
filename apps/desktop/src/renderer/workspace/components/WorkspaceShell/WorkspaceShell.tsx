import type { JSX, ReactNode } from 'react';
import './WorkspaceShell.css';

export type WorkspaceShellProps = {
  readonly titlebar: ReactNode;
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
};

export const WorkspaceShell = ({ titlebar, sidebar, children }: WorkspaceShellProps): JSX.Element => {
  return (
    <main className="tinker-workspace-shell">
      <div className="tinker-workspace-shell__titlebar">{titlebar}</div>
      <div className="tinker-workspace-shell__body">
        <div className="tinker-workspace-shell__sidebar">{sidebar}</div>
        <div className="tinker-workspace-shell__content">{children}</div>
      </div>
    </main>
  );
};
