import type { DragEvent, KeyboardEvent } from 'react';
import type { SidebarStatusEntry, WorkspaceCardModel } from '../types.js';
import './WorkspaceCard.css';

export type WorkspaceCardProps = {
  readonly workspace: WorkspaceCardModel;
  readonly active: boolean;
  readonly dragging: boolean;
  readonly dropTarget: boolean;
  readonly onActivate: (id: string) => void;
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>, id: string) => void;
  readonly onDragEnd: () => void;
  readonly onDragEnter: (id: string) => void;
  readonly onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLButtonElement>, id: string) => void;
};

const sortEntries = (entries: ReadonlyArray<SidebarStatusEntry>) =>
  [...entries].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));

export const WorkspaceCard = ({
  workspace,
  active,
  dragging,
  dropTarget,
  onActivate,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDrop,
}: WorkspaceCardProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate(workspace.id);
    }
  };
  const entries = sortEntries(workspace.entries);
  const flashClass = workspace.attention.flash ? `tk-ws-card--flash-${workspace.attention.flash}` : '';

  return (
    <button
      type="button"
      role="option"
      draggable
      aria-selected={active}
      data-card-id={workspace.id}
      data-active={active ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      data-drop-target={dropTarget ? 'true' : 'false'}
      className={['tk-ws-card', active && 'tk-ws-card--active', flashClass].filter(Boolean).join(' ')}
      onClick={() => onActivate(workspace.id)}
      onKeyDown={handleKeyDown}
      onDragStart={(event) => onDragStart(event, workspace.id)}
      onDragEnd={onDragEnd}
      onDragEnter={() => onDragEnter(workspace.id)}
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(event, workspace.id)}
    >
      <span className="tk-ws-card__header">
        <span className="tk-ws-card__title" title={workspace.title}>
          {workspace.title}
        </span>
        {workspace.pinned ? (
          <span className="tk-ws-card__pin" aria-label="pinned">
            •
          </span>
        ) : null}
        {workspace.attention.unread ? (
          <span className="tk-ws-card__unread" aria-label="unread" />
        ) : null}
      </span>
      {entries.length > 0 ? (
        <ul className="tk-ws-card__entries">
          {entries.map((entry) => (
            <li key={entry.key} className="tk-ws-card__entry" data-entry-key={entry.key}>
              <span className="tk-ws-card__entry-key">{entry.key}</span>
              <span className="tk-ws-card__entry-value" style={entry.color ? { color: entry.color } : undefined}>
                {entry.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
};
