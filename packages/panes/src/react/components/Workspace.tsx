import { useCallback, useMemo, type ReactNode } from 'react';
import type { DropTarget, StackId } from '../../types.js';
import { useWorkspaceActions, useWorkspaceSelector } from '../hooks/useWorkspaceStore.js';
import type { WorkspaceProps } from '../types.js';
import { SplitTree } from './SplitTree.js';
import { TabStrip } from './TabStrip.js';

export const Workspace = <TData,>(props: WorkspaceProps<TData>): ReactNode => {
  const { store, registry } = props;
  const tabs = useWorkspaceSelector(store, (state) => state.tabs);
  const activeTabId = useWorkspaceSelector(store, (state) => state.activeTabId);
  const actions = useWorkspaceActions(store);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? null, [tabs, activeTabId]);

  const handleActivateTab = useCallback((tabId: string) => actions.activateTab(tabId), [actions]);
  const handleCloseTab = useCallback((tabId: string) => actions.closeTab(tabId), [actions]);
  const handleMoveTab = useCallback((tabId: string, toIndex: number) => actions.moveTab(tabId, toIndex), [actions]);

  const handleFocusPane = useCallback(
    (_stackId: StackId, paneId: string) => {
      if (!activeTab) return;
      actions.focusPane(activeTab.id, paneId);
    },
    [actions, activeTab],
  );

  const handleClosePane = useCallback(
    (paneId: string) => {
      if (!activeTab) return;
      actions.closePane(activeTab.id, paneId);
    },
    [actions, activeTab],
  );

  const handleReorderPane = useCallback(
    (paneId: string, toIndex: number) => {
      if (!activeTab) return;
      actions.reorderPane(activeTab.id, paneId, toIndex);
    },
    [actions, activeTab],
  );

  const handleSetRatio = useCallback(
    (splitId: string, ratio: number) => {
      if (!activeTab) return;
      actions.setSplitRatio(activeTab.id, splitId, ratio);
    },
    [actions, activeTab],
  );

  const handleDrop = useCallback(
    ({ sourcePaneId, targetStackId, target }: { sourcePaneId: string; targetStackId: StackId; target: DropTarget }) => {
      if (!activeTab) return;
      // If the consumer supplied an intercept, let them drive movement themselves.
      if (props.onDropPane) {
        props.onDropPane({ tabId: activeTab.id, sourcePaneId, targetStackId, target });
        return;
      }
      actions.movePane(activeTab.id, sourcePaneId, targetStackId, target);
    },
    [actions, activeTab, props.onDropPane],
  );

  return (
    <section
      className="tinker-panes-workspace"
      aria-label={props.ariaLabel ?? 'Workspace'}
    >
      <TabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        registry={registry}
        {...(props.tabStripActions ? { actions: props.tabStripActions } : {})}
        onActivate={handleActivateTab}
        onClose={handleCloseTab}
        onMove={handleMoveTab}
      />
      <div
        role="tabpanel"
        id={activeTab ? `tinker-panes-tabpanel-${activeTab.id}` : undefined}
        aria-labelledby={activeTab ? `tinker-panes-tab-${activeTab.id}` : undefined}
        className="tinker-panes-surface"
      >
        {activeTab ? (
          <SplitTree
            tab={activeTab}
            registry={registry}
            onFocusPane={handleFocusPane}
            onClosePane={handleClosePane}
            onReorderPaneInStack={handleReorderPane}
            onSetRatio={handleSetRatio}
            onDropPane={handleDrop}
          />
        ) : (
          <div className="tinker-panes-empty">
            {props.emptyState ?? <p>No panes open.</p>}
          </div>
        )}
      </div>
    </section>
  );
};
