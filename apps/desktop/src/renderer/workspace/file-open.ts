import type { WorkspaceStore } from '@tinker/panes';
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

export type ResolveWorkspaceFileMime = (absolutePath: string) => Promise<string>;

type ExistingFilePane = {
  paneId: string;
  tabId: string;
  data: Extract<TinkerPaneData, { readonly kind: 'file' }>;
};

const findExistingFilePane = (
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

  const existingPane = findExistingFilePane(store, absolutePath);
  const state = store.getState();

  if (existingPane) {
    if (existingPane.data.mime !== mime) {
      state.actions.updatePaneData(existingPane.tabId, existingPane.paneId, (data) => {
        if (data.kind !== 'file') {
          return data;
        }

        return { ...data, mime };
      });
    }

    state.actions.activateTab(existingPane.tabId);
    state.actions.focusPane(existingPane.tabId, existingPane.paneId);
    return;
  }

  const pane = {
    id: getPanelIdForPath('file', absolutePath),
    kind: 'file',
    title: getPanelTitleForPath(absolutePath),
    data: {
      kind: 'file',
      path: absolutePath,
      mime,
    } as const,
  };
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];

  if (!activeTab) {
    state.actions.openTab({
      id: createWorkspaceTabId(),
      pane,
    });
    return;
  }

  state.actions.addPane(activeTab.id, pane, { activate: true });
};
