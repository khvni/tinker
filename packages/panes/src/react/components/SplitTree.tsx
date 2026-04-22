import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { DropTarget, LayoutNode, StackId, Tab } from '../../types.js';
import { clampRatio, isStack } from '../../core/utils/layout.js';
import type { PaneRegistry, WorkspaceAttentionConfig } from '../types.js';
import { ResizeHandle } from './ResizeHandle.js';
import { Stack } from './Stack.js';

type SplitTreeProps<TData> = {
  readonly tab: Tab<TData>;
  readonly registry: PaneRegistry<TData>;
  readonly attention?: WorkspaceAttentionConfig;
  readonly onFocusPane: (stackId: StackId, paneId: string) => void;
  readonly onClosePane: (paneId: string) => void;
  readonly onReorderPaneInStack: (paneId: string, toIndex: number) => void;
  readonly onSetRatio: (splitId: string, ratio: number) => void;
  readonly onDropPane: (info: { sourcePaneId: string; targetStackId: StackId; target: DropTarget }) => void;
};

export const SplitTree = <TData,>(props: SplitTreeProps<TData>): ReactNode => {
  return <SplitNode {...props} node={props.tab.layout} />;
};

type SplitNodeProps<TData> = SplitTreeProps<TData> & {
  readonly node: LayoutNode;
};

const SplitNode = <TData,>(props: SplitNodeProps<TData>): ReactNode => {
  const { node, tab, registry, onFocusPane, onClosePane, onReorderPaneInStack, onSetRatio, onDropPane } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const getContainerSize = useCallback((): number => {
    const element = containerRef.current;
    if (!element) return 0;
    if (isStack(node)) return 0;
    return node.orientation === 'row' ? element.clientWidth : element.clientHeight;
  }, [node]);

  if (isStack(node)) {
    return (
      <Stack
        tab={tab}
        node={node}
        registry={registry}
        {...(props.attention ? { attention: props.attention } : {})}
        isActiveStack={tab.activeStackId === node.id}
        onFocusPane={onFocusPane}
        onClosePane={onClosePane}
        onReorderPaneInStack={onReorderPaneInStack}
        onDropPane={onDropPane}
      />
    );
  }

  const ratio = clampRatio(node.ratio);
  const percentA = ratio * 100;
  const percentB = 100 - percentA;
  const isRow = node.orientation === 'row';

  const gridTemplate = isRow
    ? { gridTemplateColumns: `${percentA}% auto ${percentB}%` }
    : { gridTemplateRows: `${percentA}% auto ${percentB}%` };

  return (
    <div
      ref={containerRef}
      data-split-id={node.id}
      data-resizing={isResizing || undefined}
      className={`tinker-split tinker-split--${node.orientation}`}
      style={gridTemplate}
    >
      <SplitNode {...props} node={node.a} />
      <ResizeHandle
        orientation={node.orientation}
        ratio={ratio}
        onChange={(next) => onSetRatio(node.id, next)}
        getContainerSize={getContainerSize}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
      />
      <SplitNode {...props} node={node.b} />
    </div>
  );
};
