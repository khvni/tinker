import { useCallback, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import type { DropEdge, Pane } from '../../types.js';
import type { PaneDefinition } from '../types.js';

const DRAG_MIME = 'application/x-tinker-pane';

type PaneFrameProps<TData> = {
  readonly tabId: string;
  readonly pane: Pane<TData>;
  readonly isActive: boolean;
  readonly definition: PaneDefinition<TData>;
  readonly onActivate: () => void;
  readonly onClose: () => void;
  readonly onDropPane: (info: { sourcePaneId: string; edge: DropEdge }) => void;
};

const EDGE_ZONE_MARGIN = 0.28;

/**
 * Returns the closest edge when the pointer is inside one of the four edge
 * bands, or null when the pointer is in the central zone. The central zone is
 * left as a "no drop" hit zone so accidental drops in the middle don't cause
 * layout churn.
 */
const computeDropEdge = (rect: DOMRect, clientX: number, clientY: number): DropEdge | null => {
  const ratioX = (clientX - rect.left) / rect.width;
  const ratioY = (clientY - rect.top) / rect.height;
  if (Number.isNaN(ratioX) || Number.isNaN(ratioY)) return null;

  const distances: Array<[DropEdge, number]> = [];
  if (ratioX <= EDGE_ZONE_MARGIN) distances.push(['left', ratioX]);
  if (ratioX >= 1 - EDGE_ZONE_MARGIN) distances.push(['right', 1 - ratioX]);
  if (ratioY <= EDGE_ZONE_MARGIN) distances.push(['top', ratioY]);
  if (ratioY >= 1 - EDGE_ZONE_MARGIN) distances.push(['bottom', 1 - ratioY]);
  if (distances.length === 0) return null;

  distances.sort((left, right) => left[1] - right[1]);
  return distances[0]?.[0] ?? null;
};

const resolveTitle = <TData,>(definition: PaneDefinition<TData>, pane: Pane<TData>): string => {
  if (pane.title) return pane.title;
  if (typeof definition.defaultTitle === 'function') return definition.defaultTitle(pane);
  return definition.defaultTitle ?? pane.kind;
};

export const PaneFrame = <TData,>({
  tabId,
  pane,
  isActive,
  definition,
  onActivate,
  onClose,
  onDropPane,
}: PaneFrameProps<TData>): ReactNode => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [hoverEdge, setHoverEdge] = useState<DropEdge | null>(null);

  const title = useMemo(() => resolveTitle(definition, pane), [definition, pane]);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(DRAG_MIME, pane.id);
      event.dataTransfer.setData('text/plain', pane.id);
    },
    [pane.id],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const frame = frameRef.current;
      if (!frame) return;
      const hasPane = Array.from(event.dataTransfer.types).includes(DRAG_MIME);
      if (!hasPane) return;
      const sourcePaneId = event.dataTransfer.getData(DRAG_MIME);
      // `getData` returns "" in many browsers during dragover (only allowed on drop).
      // Use it opportunistically to skip self-hover; fall through otherwise.
      if (sourcePaneId && sourcePaneId === pane.id) {
        setHoverEdge(null);
        return;
      }
      const edge = computeDropEdge(frame.getBoundingClientRect(), event.clientX, event.clientY);
      if (!edge) {
        setHoverEdge(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setHoverEdge(edge);
    },
    [pane.id],
  );

  const handleDragLeave = useCallback(() => {
    setHoverEdge(null);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const sourcePaneId = event.dataTransfer.getData(DRAG_MIME);
      setHoverEdge(null);
      if (!sourcePaneId || sourcePaneId === pane.id) return;
      const frame = frameRef.current;
      if (!frame) return;
      const edge = computeDropEdge(frame.getBoundingClientRect(), event.clientX, event.clientY);
      if (!edge) return;
      event.preventDefault();
      onDropPane({ sourcePaneId, edge });
    },
    [onDropPane, pane.id],
  );

  const handleActivate = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      // Don't steal focus from the close button.
      if ((event.target as HTMLElement).closest('[data-tinker-pane-action]')) return;
      onActivate();
    },
    [onActivate],
  );

  const RenderContent = definition.render;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={title}
      data-tinker-pane-id={pane.id}
      data-tinker-tab-id={tabId}
      data-active={isActive || undefined}
      data-drop-hover={hoverEdge ? 'true' : undefined}
      className={`tinker-panes-frame${isActive ? ' tinker-panes-frame--active' : ''}`}
      onPointerDown={handleActivate}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="tinker-panes-header"
        draggable
        onDragStart={handleDragStart}
      >
        <span className="tinker-panes-title" title={title}>
          {title}
        </span>
        <button
          type="button"
          data-tinker-pane-action="close"
          className="tinker-panes-close"
          aria-label={`Close ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>
      <div className="tinker-panes-body">
        <RenderContent tabId={tabId} pane={pane} isActive={isActive} />
      </div>
      {hoverEdge ? <div className={`tinker-panes-drop tinker-panes-drop--${hoverEdge}`} aria-hidden /> : null}
    </div>
  );
};
