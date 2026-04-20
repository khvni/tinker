import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { DropEdge, LayoutNode, SplitPath, Tab } from '../../types.js';
import { DEFAULT_RATIO, clampRatio } from '../../core/utils/layout.js';
import type { PaneRegistry } from '../types.js';
import { PaneFrame } from './PaneFrame.js';
import { ResizeHandle } from './ResizeHandle.js';

type SplitTreeProps<TData> = {
  readonly tab: Tab<TData>;
  readonly registry: PaneRegistry<TData>;
  readonly onFocusPane: (paneId: string) => void;
  readonly onClosePane: (paneId: string) => void;
  readonly onSetRatio: (path: SplitPath, ratio: number) => void;
  readonly onDropPaneOnPane: (info: { sourcePaneId: string; targetPaneId: string; edge: DropEdge }) => void;
};

export const SplitTree = <TData,>(props: SplitTreeProps<TData>): ReactNode => {
  return <SplitNode {...props} node={props.tab.layout} path={[]} />;
};

type SplitNodeProps<TData> = SplitTreeProps<TData> & {
  readonly node: LayoutNode;
  readonly path: SplitPath;
};

const SplitNode = <TData,>({
  node,
  path,
  tab,
  registry,
  onFocusPane,
  onClosePane,
  onSetRatio,
  onDropPaneOnPane,
}: SplitNodeProps<TData>): ReactNode => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const getContainerSize = useCallback((): number => {
    const element = containerRef.current;
    if (!element) return 0;
    const isRowSplit = node.kind === 'split' && node.orientation === 'row';
    return isRowSplit ? element.clientWidth : element.clientHeight;
  }, [node]);

  if (node.kind === 'leaf') {
    const pane = tab.panes[node.paneId];
    if (!pane) {
      return <div className="tinker-panes-missing" role="alert">Missing pane {node.paneId}</div>;
    }
    const definition = registry[pane.kind];
    if (!definition) {
      return (
        <div className="tinker-panes-missing" role="alert">
          No renderer registered for kind &quot;{pane.kind}&quot;
        </div>
      );
    }
    return (
      <PaneFrame
        tabId={tab.id}
        pane={pane}
        isActive={tab.activePaneId === pane.id}
        definition={definition}
        onActivate={() => onFocusPane(pane.id)}
        onClose={() => onClosePane(pane.id)}
        onDropPane={({ sourcePaneId, edge }) =>
          onDropPaneOnPane({ sourcePaneId, targetPaneId: pane.id, edge })
        }
      />
    );
  }

  const ratio = clampRatio(node.ratio ?? DEFAULT_RATIO);
  const percentA = ratio * 100;
  const percentB = 100 - percentA;
  const isRow = node.orientation === 'row';

  const gridTemplate = isRow
    ? { gridTemplateColumns: `${percentA}% auto ${percentB}%` }
    : { gridTemplateRows: `${percentA}% auto ${percentB}%` };

  return (
    <div
      ref={containerRef}
      data-resizing={isResizing || undefined}
      className={`tinker-panes-split tinker-panes-split--${node.orientation}`}
      style={gridTemplate}
    >
      <SplitNode
        tab={tab}
        registry={registry}
        onFocusPane={onFocusPane}
        onClosePane={onClosePane}
        onSetRatio={onSetRatio}
        onDropPaneOnPane={onDropPaneOnPane}
        node={node.a}
        path={[...path, 'a']}
      />
      <ResizeHandle
        orientation={node.orientation}
        ratio={ratio}
        onChange={(next) => onSetRatio(path, next)}
        getContainerSize={getContainerSize}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
      />
      <SplitNode
        tab={tab}
        registry={registry}
        onFocusPane={onFocusPane}
        onClosePane={onClosePane}
        onSetRatio={onSetRatio}
        onDropPaneOnPane={onDropPaneOnPane}
        node={node.b}
        path={[...path, 'b']}
      />
    </div>
  );
};
