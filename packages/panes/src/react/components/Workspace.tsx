import { useCallback, useMemo, type ReactNode } from 'react';
import type { DropEdge, SplitPath } from '../../types.js';
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

  const handleActivateTab = useCallback(
    (tabId: string) => {
      actions.activateTab(tabId);
    },
    [actions],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      actions.closeTab(tabId);
    },
    [actions],
  );

  const handleMoveTab = useCallback(
    (tabId: string, toIndex: number) => {
      actions.moveTab(tabId, toIndex);
    },
    [actions],
  );

  const handleFocusPane = useCallback(
    (paneId: string) => {
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

  const handleSetRatio = useCallback(
    (path: SplitPath, ratio: number) => {
      if (!activeTab) return;
      actions.setSplitRatio(activeTab.id, path, ratio);
    },
    [actions, activeTab],
  );

  const handleDrop = useCallback(
    ({ sourcePaneId, targetPaneId, edge }: { sourcePaneId: string; targetPaneId: string; edge: DropEdge }) => {
      if (!activeTab) return;
      const custom = props.onDropPaneOnPane;
      if (custom) {
        custom({ tabId: activeTab.id, sourcePaneId, targetPaneId, edge });
        return;
      }
      actions.movePane(activeTab.id, sourcePaneId, targetPaneId, edge);
    },
    [actions, activeTab, props],
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
            onSetRatio={handleSetRatio}
            onDropPaneOnPane={handleDrop}
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
