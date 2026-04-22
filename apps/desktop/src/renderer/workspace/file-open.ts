import { findStackContainingPane, type WorkspaceStore } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';
import { resolveFilePaneMime } from '../panes/FilePane/file-mime.js';
import {
  getPanelIdForPath,
  getPanelTitleForPath,
  isAbsolutePath,
} from '../renderers/file-utils.js';

const createWorkspaceTabId = (): string => {
  return `workspace-${crypto.randomUUID()}`;
};

// Paper 9I-0: LeftPane 833 / RightPane 555 ≈ 0.60 of the 1388px content area.
export const FILE_PANE_SPLIT_RATIO = 0.6;

export type ResolveWorkspaceFileMime = (absolutePath: string) => Promise<string>;

type ExistingFilePane = {
  paneId: string;
  tabId: string;
  data: Extract<TinkerPaneData, { readonly kind: 'file' }>;
};

const findFilePaneByPath = (
  store: WorkspaceStore<TinkerPaneData>,
  absolutePath: string,
): ExistingFilePane | null => {
  const state = store.getState();

  for (const tab of state.tabs) {
    const existingPane = Object.values(tab.panes).find((pane) => {
      return pane.data.kind === 'file' && pane.data.path === absolutePath;
    });

    if (existingPane?.data.kind === 'file') {
      return {
        paneId: existingPane.id,
        tabId: tab.id,
        data: existingPane.data,
      };
    }
  }

  return null;
};

export const openWorkspaceFile = async (
  store: WorkspaceStore<TinkerPaneData>,
  absolutePath: string,
  resolveMime: ResolveWorkspaceFileMime = resolveFilePaneMime,
): Promise<void> => {
  if (!isAbsolutePath(absolutePath)) {
    return;
  }

  let mime = 'application/octet-stream';
  try {
    mime = await resolveMime(absolutePath);
  } catch (error) {
    console.warn(`Failed to resolve pane MIME for "${absolutePath}".`, error);
  }

  const samePathPane = findFilePaneByPath(store, absolutePath);
  if (samePathPane) {
    const { actions } = store.getState();
    if (samePathPane.data.mime !== mime) {
      actions.updatePaneData(samePathPane.tabId, samePathPane.paneId, (data) => {
        if (data.kind !== 'file') {
          return data;
        }

        return { ...data, mime };
      });
    }

    actions.activateTab(samePathPane.tabId);
    actions.focusPane(samePathPane.tabId, samePathPane.paneId);
    return;
  }

  const filePane = {
    id: getPanelIdForPath('file', absolutePath),
    kind: 'file',
    title: getPanelTitleForPath(absolutePath),
    data: {
      kind: 'file',
      path: absolutePath,
      mime,
    } as const,
  };

  const state = store.getState();
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];

  if (!activeTab) {
    state.actions.openTab({
      id: createWorkspaceTabId(),
      pane: filePane,
    });
    return;
  }

  // Replace-in-place: a different FilePane already exists in the active tab — swap its
  // data + title. Keeps the split layout, preserves Chat state, respects the
  // "single-tab-per-pane" invariant from TIN-190.
  const existingFilePaneId = Object.values(activeTab.panes).find(
    (pane) => pane.data.kind === 'file',
  )?.id;
  if (existingFilePaneId) {
    state.actions.updatePaneData(activeTab.id, existingFilePaneId, (data) => {
      if (data.kind !== 'file') {
        return data;
      }

      return { ...data, path: absolutePath, mime };
    });
    state.actions.renamePane(activeTab.id, existingFilePaneId, getPanelTitleForPath(absolutePath));
    state.actions.focusPane(activeTab.id, existingFilePaneId);
    return;
  }

  // Auto-split per Paper 9I-0: Chat stays in the anchor stack on the left,
  // FilePane opens in a fresh stack on the right at the 0.60 ratio.
  const anchorPaneId = activeTab.activePaneId ?? Object.keys(activeTab.panes)[0] ?? null;
  if (anchorPaneId) {
    const anchorStack = findStackContainingPane(activeTab.layout, anchorPaneId);
    if (anchorStack) {
      state.actions.splitStack(
        activeTab.id,
        anchorStack.id,
        'right',
        filePane,
        FILE_PANE_SPLIT_RATIO,
      );
      return;
    }
  }

  state.actions.addPane(activeTab.id, filePane, { activate: true });
};
