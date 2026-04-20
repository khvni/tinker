import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  DropEdge,
  FocusDirection,
  LayoutNode,
  Pane,
  SplitPath,
  Tab,
  WorkspaceState,
} from '../../types.js';
import {
  DEFAULT_RATIO,
  clampRatio,
  findPanePath,
  firstPaneId,
  getSpatialNeighborPaneId,
  leaf,
  removePaneFromLayout,
  setRatioAtPath,
  splitAtPath,
} from '../utils/layout.js';

export type CreatePaneInput<TData> = {
  readonly id: string;
  readonly kind: string;
  readonly data: TData;
  readonly title?: string;
  readonly pinned?: boolean;
};

export type CreateTabInput<TData> = {
  readonly id: string;
  readonly pane: CreatePaneInput<TData>;
  readonly title?: string;
  readonly createdAt?: number;
  readonly activate?: boolean;
};

export type WorkspaceActions<TData> = {
  /** Replace the whole workspace snapshot. Used for hydrating from persisted state. */
  readonly hydrate: (next: WorkspaceState<TData>) => void;
  /** Reset to an empty workspace. */
  readonly reset: () => void;

  /** Open a new tab. The tab's layout is seeded with a single pane. */
  readonly openTab: (input: CreateTabInput<TData>) => void;
  /** Close a tab by id. Activates a neighbor tab if the active one is closed. */
  readonly closeTab: (tabId: string) => void;
  /** Activate a tab. No-op if `tabId` is unknown. */
  readonly activateTab: (tabId: string) => void;
  /** Rename a tab. Pass `undefined` to clear the override. */
  readonly renameTab: (tabId: string, title: string | undefined) => void;
  /** Reorder tabs by moving `tabId` to `toIndex` (clamped to [0, tabs.length-1]). */
  readonly moveTab: (tabId: string, toIndex: number) => void;

  /**
   * Split a target pane along `edge` and insert a new pane in the new side.
   * Throws if the target pane cannot be found in any tab.
   */
  readonly splitPane: (
    tabId: string,
    targetPaneId: string,
    edge: DropEdge,
    pane: CreatePaneInput<TData>,
    ratio?: number,
  ) => void;
  /** Close a pane. Collapses its parent split. Closes the tab if it was the last pane. */
  readonly closePane: (tabId: string, paneId: string) => void;
  /** Mark a pane as active within its tab. */
  readonly focusPane: (tabId: string, paneId: string) => void;
  /** Replace the data blob on a pane. */
  readonly updatePaneData: (
    tabId: string,
    paneId: string,
    updater: (prev: TData) => TData,
  ) => void;
  /** Rename a pane. Pass `undefined` to clear the override. */
  readonly renamePane: (tabId: string, paneId: string, title: string | undefined) => void;
  /** Resize a split. `path` references the split node itself, not a leaf. */
  readonly setSplitRatio: (tabId: string, path: SplitPath, ratio: number) => void;

  /**
   * Move an existing pane to a new position relative to another pane in the
   * same tab. The pane id and data are preserved, so the React subtree stays
   * mounted across the move. No-op when `sourcePaneId === targetPaneId`.
   */
  readonly movePane: (
    tabId: string,
    sourcePaneId: string,
    targetPaneId: string,
    edge: DropEdge,
  ) => void;

  /** Move focus in a direction within the active tab. Returns the new pane id or null. */
  readonly focusNeighbor: (direction: FocusDirection) => string | null;
};

export type WorkspaceStoreState<TData> = WorkspaceState<TData> & { readonly actions: WorkspaceActions<TData> };

export type WorkspaceStore<TData> = StoreApi<WorkspaceStoreState<TData>>;

export type CreateWorkspaceStoreOptions<TData> = {
  readonly initial?: WorkspaceState<TData>;
};

const emptyWorkspace = <TData>(): WorkspaceState<TData> => ({
  version: 1,
  tabs: [],
  activeTabId: null,
});

const clone = <TData>(state: WorkspaceState<TData>): WorkspaceState<TData> => ({
  version: 1,
  activeTabId: state.activeTabId,
  tabs: state.tabs.map((tab) => ({
    ...tab,
    panes: { ...tab.panes },
  })),
});

const setTab = <TData>(
  state: WorkspaceState<TData>,
  tabId: string,
  transform: (tab: Tab<TData>) => Tab<TData>,
): WorkspaceState<TData> => {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === tabId ? transform(tab) : tab)),
  };
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
        const paneRecord: Pane<TData> = {
          id: pane.id,
          kind: pane.kind,
          data: pane.data,
          ...(pane.title === undefined ? {} : { title: pane.title }),
          ...(pane.pinned === undefined ? {} : { pinned: pane.pinned }),
        };
        const tab: Tab<TData> = {
          id,
          ...(title === undefined ? {} : { title }),
          createdAt: createdAt ?? Date.now(),
          activePaneId: pane.id,
          layout: leaf(pane.id),
          panes: { [pane.id]: paneRecord },
        };
        const nextActive = activate ? id : get().activeTabId ?? id;
        set({
          tabs: [...get().tabs, tab],
          activeTabId: nextActive,
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
              return { ...rest } as Tab<TData>;
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
      splitPane: (tabId, targetPaneId, edge, pane, ratio) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) throw new Error(`splitPane: unknown tab ${tabId}`);
        const path = findPanePath(tab.layout, targetPaneId);
        if (!path) throw new Error(`splitPane: pane ${targetPaneId} not in tab ${tabId}`);
        if (tab.panes[pane.id]) throw new Error(`splitPane: pane id ${pane.id} already exists in tab ${tabId}`);

        const newLeaf = leaf(pane.id);
        const nextLayout = splitAtPath(tab.layout, path, newLeaf, edge, ratio ?? DEFAULT_RATIO);
        const paneRecord: Pane<TData> = {
          id: pane.id,
          kind: pane.kind,
          data: pane.data,
          ...(pane.title === undefined ? {} : { title: pane.title }),
          ...(pane.pinned === undefined ? {} : { pinned: pane.pinned }),
        };
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            panes: { ...existing.panes, [paneRecord.id]: paneRecord },
            activePaneId: paneRecord.id,
          })),
        );
      },
      closePane: (tabId, paneId) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        if (!tab.panes[paneId]) return;
        const nextLayout = removePaneFromLayout(tab.layout, paneId);
        if (nextLayout === null) {
          get().actions.closeTab(tabId);
          return;
        }
        const { [paneId]: _removed, ...rest } = tab.panes;
        const nextActive = tab.activePaneId === paneId ? firstPaneId(nextLayout) : tab.activePaneId;
        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            panes: rest,
            activePaneId: nextActive,
          })),
        );
      },
      focusPane: (tabId, paneId) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        if (!tab.panes[paneId]) return;
        set(setTab(current, tabId, (existing) => ({ ...existing, activePaneId: paneId })));
      },
      updatePaneData: (tabId, paneId, updater) => {
        const current = get();
        set(
          setTab(current, tabId, (tab) => {
            const pane = tab.panes[paneId];
            if (!pane) return tab;
            const nextPane: Pane<TData> = { ...pane, data: updater(pane.data) };
            return { ...tab, panes: { ...tab.panes, [paneId]: nextPane } };
          }),
        );
      },
      renamePane: (tabId, paneId, title) => {
        const current = get();
        set(
          setTab(current, tabId, (tab) => {
            const pane = tab.panes[paneId];
            if (!pane) return tab;
            let nextPane: Pane<TData>;
            if (title === undefined) {
              const { title: _omit, ...rest } = pane;
              nextPane = { ...rest } as Pane<TData>;
            } else {
              nextPane = { ...pane, title };
            }
            return { ...tab, panes: { ...tab.panes, [paneId]: nextPane } };
          }),
        );
      },
      setSplitRatio: (tabId, path, ratio) => {
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        const nextLayout = setRatioAtPath(tab.layout, path, clampRatio(ratio));
        set(setTab(current, tabId, (existing) => ({ ...existing, layout: nextLayout })));
      },
      movePane: (tabId, sourcePaneId, targetPaneId, edge) => {
        if (sourcePaneId === targetPaneId) return;
        const current = get();
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) return;
        if (!tab.panes[sourcePaneId] || !tab.panes[targetPaneId]) return;

        // Remove the source leaf from the tree (collapses empty parents).
        const withoutSource = removePaneFromLayout(tab.layout, sourcePaneId);
        if (!withoutSource) return; // source was the sole leaf — nothing to move onto

        const targetPath = findPanePath(withoutSource, targetPaneId);
        if (!targetPath) return; // target was nested inside the removed subtree (impossible)

        const nextLayout = splitAtPath(
          withoutSource,
          targetPath,
          leaf(sourcePaneId),
          edge,
          DEFAULT_RATIO,
        );

        set(
          setTab(current, tabId, (existing) => ({
            ...existing,
            layout: nextLayout,
            activePaneId: sourcePaneId,
          })),
        );
      },
      focusNeighbor: (direction) => {
        const current = get();
        const tabId = current.activeTabId;
        if (!tabId) return null;
        const tab = current.tabs.find((candidate) => candidate.id === tabId);
        if (!tab || !tab.activePaneId) return null;
        const neighbor = getSpatialNeighborPaneId(tab.layout, tab.activePaneId, direction);
        if (!neighbor) return null;
        get().actions.focusPane(tabId, neighbor);
        return neighbor;
      },
    },
  }));
};

export const selectWorkspaceSnapshot = <TData>(state: WorkspaceState<TData>): WorkspaceState<TData> => ({
  version: 1,
  activeTabId: state.activeTabId,
  tabs: state.tabs.map((tab) => ({ ...tab, panes: { ...tab.panes } })),
});

export const findActiveTab = <TData>(state: WorkspaceState<TData>): Tab<TData> | null => {
  if (!state.activeTabId) return null;
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
};

export const findTabContainingPane = <TData>(
  state: WorkspaceState<TData>,
  paneId: string,
): Tab<TData> | null => {
  for (const tab of state.tabs) {
    if (tab.panes[paneId]) return tab;
  }
  return null;
};

export const findLayoutRoot = <TData>(state: WorkspaceState<TData>): LayoutNode | null => {
  const tab = findActiveTab(state);
  return tab ? tab.layout : null;
};
