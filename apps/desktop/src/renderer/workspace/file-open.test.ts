import { describe, expect, it } from 'vitest';
import type { TinkerPaneData } from '@tinker/shared-types';
import { getPanelIdForPath, XLSX_MIME } from '../renderers/file-utils.js';
import { openWorkspaceFile } from './file-open.js';
import { createDefaultWorkspaceState } from './layout.default.js';

type TestPane = {
  id: string;
  kind: TinkerPaneData['kind'];
  title?: string;
  data: TinkerPaneData;
};

type TestTab = {
  id: string;
  createdAt: number;
  layout: {
    kind: 'stack';
    id: string;
    paneIds: string[];
    activePaneId: string;
  };
  panes: Record<string, TestPane>;
  activePaneId: string;
  activeStackId: string;
};

type TestStoreState = {
  tabs: TestTab[];
  activeTabId: string | null;
  actions: {
    activateTab: (tabId: string) => void;
    focusPane: (tabId: string, paneId: string) => void;
    openTab: (input: { id: string; pane: TestPane }) => void;
    addPane: (tabId: string, pane: TestPane, options?: { activate?: boolean }) => void;
  };
};

const cloneTabs = (): TestTab[] => {
  const snapshot = createDefaultWorkspaceState();

  return snapshot.tabs.map((tab) => ({
    ...tab,
    layout: {
      kind: 'stack',
      id: tab.activeStackId,
      paneIds: [tab.activePaneId],
      activePaneId: tab.activePaneId,
    },
    panes: Object.fromEntries(
      Object.values(tab.panes).map((pane) => [
        pane.id,
        {
          id: pane.id,
          kind: pane.kind,
          title: pane.title,
          data: pane.data,
        },
      ]),
    ),
  }));
};

const createTestStore = (): { getState: () => TestStoreState } => {
  const tabs = cloneTabs();
  const state: TestStoreState = {
    tabs,
    activeTabId: tabs[0]?.id ?? null,
    actions: {
      activateTab: (tabId) => {
        state.activeTabId = tabId;
      },
      focusPane: (tabId, paneId) => {
        const tab = state.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) {
          return;
        }

        tab.activePaneId = paneId;
        tab.layout.activePaneId = paneId;
        if (!tab.layout.paneIds.includes(paneId)) {
          tab.layout.paneIds.push(paneId);
        }
      },
      openTab: ({ id, pane }) => {
        state.tabs.push({
          id,
          createdAt: Date.now(),
          layout: {
            kind: 'stack',
            id: `${id}-stack`,
            paneIds: [pane.id],
            activePaneId: pane.id,
          },
          panes: {
            [pane.id]: pane,
          },
          activePaneId: pane.id,
          activeStackId: `${id}-stack`,
        });
        state.activeTabId = id;
      },
      addPane: (tabId, pane, options = {}) => {
        const tab = state.tabs.find((candidate) => candidate.id === tabId);
        if (!tab) {
          return;
        }

        tab.panes[pane.id] = pane;
        if (!tab.layout.paneIds.includes(pane.id)) {
          tab.layout.paneIds.push(pane.id);
        }
        if (options.activate ?? true) {
          tab.activePaneId = pane.id;
          tab.layout.activePaneId = pane.id;
        }
      },
    },
  };

  return {
    getState: () => state,
  };
};

describe('openWorkspaceFile', () => {
  it('focuses an existing file pane instead of opening a duplicate', () => {
    const store = createTestStore();
    const tabId = store.getState().activeTabId;
    if (!tabId) {
      throw new Error('expected an active workspace tab');
    }

    store.getState().actions.addPane(tabId, {
      id: getPanelIdForPath('file', '/vault/note.ts'),
      kind: 'file',
      title: 'note.ts',
      data: {
        kind: 'file',
        path: '/vault/note.ts',
        mime: 'application/typescript',
      },
    });

    openWorkspaceFile(store, '/vault/note.ts');

    expect(store.getState().tabs[0]?.activePaneId).toBe(getPanelIdForPath('file', '/vault/note.ts'));
  });

  it('creates a new file pane in the active workspace tab when none exists', () => {
    const store = createTestStore();

    openWorkspaceFile(store, '/vault/note.ts');

    const activeTab = store.getState().tabs[0];
    expect(activeTab?.panes[getPanelIdForPath('file', '/vault/note.ts')]?.data).toEqual({
      kind: 'file',
      path: '/vault/note.ts',
      mime: 'application/typescript',
    });
  });

  it('creates a workspace tab when file opens into an empty store', () => {
    const store = createTestStore();
    store.getState().tabs = [];
    store.getState().activeTabId = null;

    openWorkspaceFile(store, '/vault/readme.md');

    expect(store.getState().tabs).toHaveLength(1);
    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/readme.md')]?.data).toEqual({
      kind: 'file',
      path: '/vault/readme.md',
      mime: 'text/markdown',
    });
  });

  it('infers spreadsheet mime for xlsx files', () => {
    const store = createTestStore();

    openWorkspaceFile(store, '/vault/roadmap.xlsx');

    const activeTab = store.getState().tabs[0];
    expect(activeTab?.panes[getPanelIdForPath('file', '/vault/roadmap.xlsx')]?.data).toEqual({
      kind: 'file',
      path: '/vault/roadmap.xlsx',
      mime: XLSX_MIME,
    });
  });
});
