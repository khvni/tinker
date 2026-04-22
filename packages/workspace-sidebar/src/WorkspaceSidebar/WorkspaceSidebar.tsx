import { useState, type DragEvent, type ReactNode } from 'react';
import { WorkspaceCard } from '../WorkspaceCard/index.js';
import type { WorkspaceCardModel } from '../types.js';
import './WorkspaceSidebar.css';

export type WorkspaceSidebarProps = {
  readonly workspaces: ReadonlyArray<WorkspaceCardModel>;
  readonly activeWorkspaceId: string | null;
  readonly onActivate: (id: string) => void;
  readonly onReorder: (id: string, toIndex: number) => void;
  readonly onAddWorkspace: () => void;
  readonly footer?: ReactNode;
  readonly ariaLabel?: string;
};

const DRAG_MIME = 'application/x-tinker-workspace-id';

export const WorkspaceSidebar = ({
  workspaces,
  activeWorkspaceId,
  onActivate,
  onReorder,
  onAddWorkspace,
  footer,
  ariaLabel = 'Workspaces',
}: WorkspaceSidebarProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, id: string) => {
    event.dataTransfer.setData(DRAG_MIME, id);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, toId: string) => {
    event.preventDefault();
    const fromId = event.dataTransfer.getData(DRAG_MIME) || draggingId;
    setDraggingId(null);
    setDropTargetId(null);
    if (!fromId || fromId === toId) return;
    const toIndex = workspaces.findIndex((w) => w.id === toId);
    if (toIndex === -1) return;
    onReorder(fromId, toIndex);
  };

  return (
    <aside className="tk-ws-sidebar" aria-label={ariaLabel}>
      <ul
        className="tk-ws-sidebar__list"
        role="listbox"
        aria-label={ariaLabel}
        data-testid="workspace-sidebar-list"
      >
        {workspaces.map((workspace) => (
          <li key={workspace.id} className="tk-ws-sidebar__item">
            <WorkspaceCard
              workspace={workspace}
              active={workspace.id === activeWorkspaceId}
              dragging={workspace.id === draggingId}
              dropTarget={workspace.id === dropTargetId && workspace.id !== draggingId}
              onActivate={onActivate}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragEnter={setDropTargetId}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="tk-ws-sidebar__add"
        onClick={onAddWorkspace}
        aria-label="Add workspace"
      >
        +
      </button>
      {footer != null ? <div className="tk-ws-sidebar__footer">{footer}</div> : null}
    </aside>
  );
};
