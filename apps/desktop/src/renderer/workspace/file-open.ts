import type { WorkspaceStore } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';
import {
  getFileExtension,
  getImageMimeType,
  getPanelIdForPath,
  getPanelTitleForPath,
  isAbsolutePath,
} from '../renderers/file-utils.js';

const createWorkspaceTabId = (): string => {
  return `workspace-${crypto.randomUUID()}`;
};

const getPaneMimeForPath = (absolutePath: string): string => {
  switch (getFileExtension(absolutePath)) {
    case '.csv':
      return 'text/csv';
    case '.gif':
    case '.jpeg':
    case '.jpg':
    case '.png':
    case '.svg':
    case '.webp':
      return getImageMimeType(absolutePath);
    case '.htm':
    case '.html':
      return 'text/html';
    case '.json':
      return 'application/json';
    case '.md':
      return 'text/markdown';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.mjs':
    case '.js':
      return 'text/javascript';
    case '.ts':
      return 'application/typescript';
    case '.tsx':
      return 'text/typescript';
    default:
      return 'text/plain';
  }
};

export const openWorkspaceFile = (store: WorkspaceStore<TinkerPaneData>, absolutePath: string): void => {
  if (!isAbsolutePath(absolutePath)) {
    return;
  }

  const state = store.getState();
  for (const tab of state.tabs) {
    const existingPane = Object.values(tab.panes).find((pane) => {
      return pane.data.kind === 'file' && pane.data.path === absolutePath;
    });

    if (!existingPane) {
      continue;
    }

    state.actions.activateTab(tab.id);
    state.actions.focusPane(tab.id, existingPane.id);
    return;
  }

  const pane = {
    id: getPanelIdForPath('file', absolutePath),
    kind: 'file',
    title: getPanelTitleForPath(absolutePath),
    data: {
      kind: 'file',
      path: absolutePath,
      mime: getPaneMimeForPath(absolutePath),
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
