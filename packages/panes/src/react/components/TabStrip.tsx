import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { Tab } from '../../types.js';
import type { PaneRegistry, TabStripAction } from '../types.js';

const TAB_DRAG_MIME = 'application/x-tinker-tab';

type TabStripProps<TData> = {
  readonly tabs: ReadonlyArray<Tab<TData>>;
  readonly activeTabId: string | null;
  readonly registry: PaneRegistry<TData>;
  readonly actions?: ReadonlyArray<TabStripAction>;
  readonly onActivate: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
  readonly onMove: (tabId: string, toIndex: number) => void;
};

export const resolveTabTitle = <TData,>(tab: Tab<TData>, registry: PaneRegistry<TData>): string => {
  if (tab.title) return tab.title;
  const activePaneId = tab.activePaneId ?? Object.keys(tab.panes)[0] ?? null;
  const pane = activePaneId ? tab.panes[activePaneId] : undefined;
  if (!pane) return 'Untitled';
  if (pane.title) return pane.title;
  const definition = registry[pane.kind];
  if (definition?.defaultTitle) {
    return typeof definition.defaultTitle === 'function' ? definition.defaultTitle(pane) : definition.defaultTitle;
  }
  return pane.kind;
};

export const TabStrip = <TData,>({
  tabs,
  activeTabId,
  registry,
  actions,
  onActivate,
  onClose,
  onMove,
}: TabStripProps<TData>): ReactNode => {
  const dragIndexRef = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (event: DragEvent<HTMLButtonElement>) => {
    dragIndexRef.current = index;
    const tab = tabs[index];
    if (!tab) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(TAB_DRAG_MIME, tab.id);
  };

  const handleDragOver = (index: number) => (event: DragEvent<HTMLButtonElement>) => {
    const hasTab = Array.from(event.dataTransfer.types).includes(TAB_DRAG_MIME);
    if (!hasTab) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = (index: number) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData(TAB_DRAG_MIME);
    setDropIndex(null);
    dragIndexRef.current = null;
    if (!sourceId) return;
    onMove(sourceId, index);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = tabs[Math.min(index + 1, tabs.length - 1)];
      if (next) onActivate(next.id);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = tabs[Math.max(index - 1, 0)];
      if (next) onActivate(next.id);
      return;
    }
    if (event.key === 'Delete' || (event.metaKey && event.key === 'w')) {
      event.preventDefault();
      const tab = tabs[index];
      if (tab) onClose(tab.id);
    }
  };

  return (
    <div role="tablist" aria-label="Workspace tabs" className="tinker-panes-tabstrip">
      <div className="tinker-panes-tabstrip__tabs">
        {tabs.map((tab, index) => {
          const isActive = activeTabId === tab.id;
          const title = resolveTabTitle(tab, registry);
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tinker-panes-tabpanel-${tab.id}`}
              id={`tinker-panes-tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(index)}
              onClick={() => onActivate(tab.id)}
              onKeyDown={handleKeyDown(index)}
              data-drop-target={dropIndex === index || undefined}
              className={`tinker-panes-tab${isActive ? ' tinker-panes-tab--active' : ''}`}
            >
              <span className="tinker-panes-tab__label" title={title}>
                {title}
              </span>
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Close tab ${title}`}
                className="tinker-panes-tab__close"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.id);
                }}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
      {actions && actions.length > 0 ? (
        <div className="tinker-panes-tabstrip__actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="tinker-panes-tabstrip__action"
              onClick={action.onSelect}
              disabled={action.disabled}
              aria-label={action.label}
              title={action.label}
            >
              {action.icon ?? action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
