import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  DropTarget,
  FocusDirection,
  LayoutNode,
  Pane,
  PaneId,
  StackId,
  StackNode,
  Tab,
  TabId,
  WorkspaceState,
} from '../../types.js';
import {
  clampRatio,
  collapseEmptyStacks,
  findStack,
  findStackContainingPane,
  firstPaneId,
  firstStackId,
  getSpatialNeighborStackId,
  insertPaneInStack,
  movePaneToStack,
  removePaneFromStack,
  reorderPaneInStack,
  replaceStack,
  setSplitRatioById,
  splitStackOnEdge,
  stack,
} from '../utils/layout.js';

export type CreatePaneInput<TData> = {
  readonly id: PaneId;
  readonly kind: string;
  readonly data: TData;
  readonly title?: string;
  readonly pinned?: boolean;
};

export type CreateTabInput<TData> = {
  readonly id: TabId;
  readonly pane: CreatePaneInput<TData>;
  readonly title?: string;
  readonly createdAt?: number;
  readonly activate?: boolean;
};

export type WorkspaceActions<TData> = {
  readonly hydrate: (next: WorkspaceState<TData>) => void;
  readonly reset: () => void;

  // Tab management
  readonly openTab: (input: CreateTabInput<TData>) => void;
  readonly closeTab: (tabId: TabId) => void;
  readonly activateTab: (tabId: TabId) => void;
  readonly renameTab: (tabId: TabId, title: string | undefined) => void;
  readonly moveTab: (tabId: TabId, toIndex: number) => void;

  // Pane management — all operate inside a single Tab's layout tree.
  /** Open a new pane inside an existing stack. If stackId is omitted, uses the tab's active stack. */
  readonly addPane: (
    tabId: TabId,
    pane: CreatePaneInput<TData>,
    options?: { readonly stackId?: StackId; readonly index?: number; readonly activate?: boolean },
  ) => void;
  /** Split a stack along edge and open a new pane in the resulting stack. */
  readonly splitStack: (
    tabId: TabId,
    stackId: StackId,
    edge: 'top' | 'right' | 'bottom' | 'left',
    pane: CreatePaneInput<TData>,
    ratio?: number,
  ) => void;
  /** Back-compat helper: split the stack containing targetPaneId on `edge`. */
  readonly splitPane: (
    tabId: TabId,
    targetPaneId: PaneId,
    edge: 'top' | 'right' | 'bottom' | 'left',
    pane: CreatePaneInput<TData>,
    ratio?: number,
  ) => void;
  readonly closePane: (tabId: TabId, paneId: PaneId) => void;
  readonly duplicatePane: (tabId: TabId, paneId: PaneId) => void;
  readonly focusPane: (tabId: TabId, paneId: PaneId) => void;
  readonly focusStack: (tabId: TabId, stackId: StackId) => void;
  readonly updatePaneData: (
    tabId: TabId,
    paneId: PaneId,
    updater: (prev: TData) => TData,
  ) => void;
  readonly renamePane: (tabId: TabId, paneId: PaneId, title: string | undefined) => void;

  // Layout manipulation
  readonly setSplitRatio: (tabId: TabId, splitId: string, ratio: number) => void;
  /** Reorder a pane within its own stack. */
  readonly reorderPane: (tabId: TabId, paneId: PaneId, toIndex: number) => void;
  /**
   * Move a pane to a drop target relative to a stack. This is the primary
   * drag-drop entry point.
   */
  readonly movePane: (
    tabId: TabId,
    paneId: PaneId,
    targetStackId: StackId,
    target: DropTarget,
  ) => void;

  // Keyboard nav
  readonly focusNeighbor: (direction: FocusDirection) => PaneId | null;
};

export type WorkspaceStoreState<TData> = WorkspaceState<TData> & { readonly actions: WorkspaceActions<TData> };
export type WorkspaceStore<TData> = StoreApi<WorkspaceStoreState<TData>>;

export type CreateWorkspaceStoreOptions<TData> = {
  readonly initial?: WorkspaceState<TData>;
};

const emptyWorkspace = <TData>(): WorkspaceState<TData> => ({
  version: 2,
  tabs: [],
  activeTabId: null,
});

const clone = <TData>(state: WorkspaceState<TData>): WorkspaceState<TData> => ({
  version: 2,
  activeTabId: state.activeTabId,
  tabs: state.tabs.map((tab) => ({ ...tab, panes: { ...tab.panes } })),
});

const setTab = <TData>(
  state: WorkspaceState<TData>,
  tabId: TabId,
  transform: (tab: Tab<TData>) => Tab<TData>,
): WorkspaceState<TData> => ({
  ...state,
  tabs: state.tabs.map((tab) => (tab.id === tabId ? transform(tab) : tab)),
});

const buildPane = <TData>(input: CreatePaneInput<TData>): Pane<TData> => ({
  id: input.id,
  kind: input.kind,
  data: input.data,
  ...(input.title === undefined ? {} : { title: input.title }),
  ...(input.pinned === undefined ? {} : { pinned: input.pinned }),
});

/**
 * Pick the next active stack+pane after a close/remove. Prefers the currently
 * active stack if still present; falls back left-first through the tree.
 */
const resolveActive = <TData>(
  layout: LayoutNode,
  panes: Readonly<Record<PaneId, Pane<TData>>>,
  prevStackId: StackId | null,
  prevPaneId: PaneId | null,
): { readonly stackId: StackId | null; readonly paneId: PaneId | null } => {
  const stackId =
    prevStackId && findStack(layout, prevStackId) ? prevStackId : firstStackId(layout);
  const host = stackId ? findStack(layout, stackId) : null;
  const paneId =
    prevPaneId && panes[prevPaneId] && host?.paneIds.includes(prevPaneId)
      ? prevPaneId
      : host?.activePaneId ?? firstPaneId(layout);
  return { stackId, paneId };
};

export const createWorkspaceStore = <TData>(
  options: CreateWorkspaceStoreOptions<TData> = {},
): WorkspaceStore<TData> => {
  const initial = options.initial ? clone(options.initial) : emptyWorkspace<TData>();

  return createStore<WorkspaceStoreState<TData>>((set, get) => ({
    ...initial,
    actions: {
      hydrate: (next) => {
        set({ ...clone(next), actions: get().actions });
      },
      reset: () => {
        set({ ...emptyWorkspace<TData>(), actions: get().actions });
      },

      openTab: ({ id, pane, title, createdAt, activate = true }) => {
        const existing = get().tabs.find((tab) => tab.id === id);
        if (existing) {
          if (activate) set({ activeTabId: id });
          return;
        }
        const paneRecord = buildPane(pane);
        const rootStack = stack([paneRecord.id], paneRecord.id);
        const tab: Tab<TData> = {
          id,
          ...(title === undefined ? {} : { title }),
          createdAt: createdAt ?? Date.now(),
          layout: rootStack,
          panes: { [paneRecord.id]: paneRecord },
          activePaneId: paneRecord.id,
          activeStackId: rootStack.id,
        };
        set({
          tabs: [...get().tabs, tab],
          activeTabId: activate ? id : (get().activeTabId ?? id),
        });
      },

      closeTab: (tabId) => {
        const current = get();
        const index = current.tabs.findIndex((tab) => tab.id === tabId);
        if (index === -1) return;
        const nextTabs = current.tabs.filter((tab) => tab.id !== tabId);
        let nextActive = current.activeTabId;
        if (current.activeTabId === tabId) {
          const neighbor = nextTabs[index] ?? nextTabs[index - 1] ?? null;
          nextActive = neighbor ? neighbor.id : null;
        }
        set({ tabs: nextTabs, activeTabId: nextActive });
      },

      activateTab: (tabId) => {
        if (!get().tabs.some((tab) => tab.id === tabId)) return;
        set({ activeTabId: tabId });
      },

      renameTab: (tabId, title) => {
        set(
          setTab(get(), tabId, (tab) => {
            if (title === undefined) {
              const { title: _omit, ...rest } = tab;
              return rest as Tab<TData>;
            }
            return { ...tab, title };
          }),
        );
      },

      moveTab: (tabId, toIndex) => {
        const current = get();
        const from = current.tabs.findIndex((tab) => tab.id === tabId);
        if (from === -1) return;
        const clamped = Math.max(0, Math.min(toIndex, current.tabs.length - 1));
        if (from === clamped) return;
        const next = current.tabs.slice();
        const [moved] = next.splice(from, 1);
        if (!moved) return;
        next.splice(clamped, 0, moved);
        set({ tabs: next });
      },

      addPane: (tabId, paneInput, { stackId, index, activate = true } = {}) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        if (tab.panes[paneInput.id]) throw new Error(`addPane: pane ${paneInput.id} already exists`);
        const targetStackId = stackId ?? tab.activeStackId ?? firstStackId(tab.layout);
        if (!targetStackId) return;
        const targetStack = findStack(tab.layout, targetStackId);
        if (!targetStack) return;
        const paneRecord = buildPane(paneInput);
        const updatedStack = insertPaneInStack(targetStack, paneRecord.id, index);
        const withActive = activate ? { ...updatedStack, activePaneId: paneRecord.id } : updatedStack;
        const nextLayout = replaceStack(tab.layout, targetStack.id, withActive);
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            panes: { ...existing.panes, [paneRecord.id]: paneRecord },
            activePaneId: activate ? paneRecord.id : existing.activePaneId,
            activeStackId: targetStack.id,
          })),
        );
      },

      splitStack: (tabId, stackId, edge, paneInput, ratio) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) throw new Error(`splitStack: tab ${tabId} not found`);
        const target = findStack(tab.layout, stackId);
        if (!target) throw new Error(`splitStack: stack ${stackId} not found`);
        if (tab.panes[paneInput.id]) throw new Error(`splitStack: pane ${paneInput.id} already exists`);
        const paneRecord = buildPane(paneInput);
        const newStack = stack([paneRecord.id], paneRecord.id);
        const nextLayout = splitStackOnEdge(tab.layout, stackId, edge, newStack, ratio);
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            panes: { ...existing.panes, [paneRecord.id]: paneRecord },
            activePaneId: paneRecord.id,
            activeStackId: newStack.id,
          })),
        );
      },

      splitPane: (tabId, targetPaneId, edge, paneInput, ratio) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) throw new Error(`splitPane: tab ${tabId} not found`);
        const host = findStackContainingPane(tab.layout, targetPaneId);
        if (!host) throw new Error(`splitPane: pane ${targetPaneId} not in tab`);
        get().actions.splitStack(tabId, host.id, edge, paneInput, ratio);
      },

      closePane: (tabId, paneId) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        if (!tab.panes[paneId]) return;
        const host = findStackContainingPane(tab.layout, paneId);
        if (!host) return;
        const layoutWithUpdated = replaceStack(tab.layout, host.id, removePaneFromStack(host, paneId));
        const collapsed = collapseEmptyStacks(layoutWithUpdated);
        if (!collapsed) {
          get().actions.closeTab(tabId);
          return;
        }
        const { [paneId]: _removed, ...remainingPanes } = tab.panes;
        const next = resolveActive(collapsed, remainingPanes, tab.activeStackId, tab.activePaneId);
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: collapsed,
            panes: remainingPanes,
            activePaneId: next.paneId,
            activeStackId: next.stackId,
          })),
        );
      },

      duplicatePane: (tabId, paneId) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        const source = tab.panes[paneId];
        if (!source) return;
        const newPaneId = `${paneId}-copy-${crypto.randomUUID()}`;
        const paneRecord: Pane<TData> = { ...source, id: newPaneId };
        const host = findStackContainingPane(tab.layout, paneId);
        if (!host) return;
        const updatedStack = insertPaneInStack(host, paneRecord.id);
        const nextLayout = replaceStack(tab.layout, host.id, { ...updatedStack, activePaneId: paneRecord.id });
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            panes: { ...existing.panes, [paneRecord.id]: paneRecord },
            activePaneId: paneRecord.id,
            activeStackId: host.id,
          })),
        );
      },

      focusPane: (tabId, paneId) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        if (!tab.panes[paneId]) return;
        const host = findStackContainingPane(tab.layout, paneId);
        if (!host) return;
        const updatedStack: StackNode = { ...host, activePaneId: paneId };
        const nextLayout = replaceStack(tab.layout, host.id, updatedStack);
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            activePaneId: paneId,
            activeStackId: host.id,
          })),
        );
      },

      focusStack: (tabId, stackId) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        const target = findStack(tab.layout, stackId);
        if (!target) return;
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            activeStackId: stackId,
            activePaneId: target.activePaneId ?? existing.activePaneId,
          })),
        );
      },

      updatePaneData: (tabId, paneId, updater) => {
        const current = get();
        set(
          setTab(current, tabId, (tab) => {
            const pane = tab.panes[paneId];
            if (!pane) return tab;
            return { ...tab, panes: { ...tab.panes, [paneId]: { ...pane, data: updater(pane.data) } } };
          }),
        );
      },

      renamePane: (tabId, paneId, title) => {
        const current = get();
        set(
          setTab(current, tabId, (tab) => {
            const pane = tab.panes[paneId];
            if (!pane) return tab;
            let next: Pane<TData>;
            if (title === undefined) {
              const { title: _omit, ...rest } = pane;
              next = rest as Pane<TData>;
            } else {
              next = { ...pane, title };
            }
            return { ...tab, panes: { ...tab.panes, [paneId]: next } };
          }),
        );
      },

      setSplitRatio: (tabId, splitId, ratio) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        const nextLayout = setSplitRatioById(tab.layout, splitId, clampRatio(ratio));
        if (nextLayout === tab.layout) return;
        set(setTab(current, tabId, (existing) => ({ ...existing, layout: nextLayout })));
      },

      reorderPane: (tabId, paneId, toIndex) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        const host = findStackContainingPane(tab.layout, paneId);
        if (!host) return;
        const updatedStack = reorderPaneInStack(host, paneId, toIndex);
        if (updatedStack === host) return;
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: replaceStack(existing.layout, host.id, updatedStack),
          })),
        );
      },

      movePane: (tabId, paneId, targetStackId, target) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        const result = movePaneToStack(tab.layout, paneId, targetStackId, target);
        if (!result) return;
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: result.layout,
            activePaneId: paneId,
            activeStackId: result.activeStackId,
          })),
        );
      },

      focusNeighbor: (direction) => {
        const current = get();
        const tabId = current.activeTabId;
        if (!tabId) return null;
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab || !tab.activeStackId) return null;
        const neighborStackId = getSpatialNeighborStackId(tab.layout, tab.activeStackId, direction);
        if (!neighborStackId) return null;
        const neighborStack = findStack(tab.layout, neighborStackId);
        if (!neighborStack || !neighborStack.activePaneId) return null;
        get().actions.focusPane(tabId, neighborStack.activePaneId);
        return neighborStack.activePaneId;
      },
    },
  }));
};

export const selectWorkspaceSnapshot = <TData>(state: WorkspaceState<TData>): WorkspaceState<TData> => ({
  version: 2,
  activeTabId: state.activeTabId,
  tabs: state.tabs.map((tab) => ({ ...tab, panes: { ...tab.panes } })),
});

export const findActiveTab = <TData>(state: WorkspaceState<TData>): Tab<TData> | null => {
  if (!state.activeTabId) return null;
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
};

// Type guard re-exported to help callers discriminate.
export { isStack, isSplit } from '../utils/layout.js';
