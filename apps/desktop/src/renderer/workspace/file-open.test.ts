import { createWorkspaceStore, isSplit, isStack, selectWorkspaceSnapshot } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';
import { describe, expect, it } from 'vitest';
import { MISSING_FILE_MIME } from '../panes/FilePane/index.js';
import { getPanelIdForPath, XLSX_MIME } from '../renderers/file-utils.js';
import { FILE_PANE_SPLIT_RATIO, openWorkspaceFile } from './file-open.js';
import { createDefaultWorkspaceState } from './layout.default.js';

describe('openWorkspaceFile', () => {
  it('focuses an existing file pane instead of opening a duplicate', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });
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

    await openWorkspaceFile(store, '/vault/note.ts', async () => 'application/typescript');

    expect(store.getState().tabs[0]?.activePaneId).toBe(getPanelIdForPath('file', '/vault/note.ts'));
  });

  it('auto-splits the active tab on the right at the 0.60 ratio with Chat on the left', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });
    const initialTab = store.getState().tabs[0];
    const chatPaneId = initialTab ? Object.keys(initialTab.panes)[0] : null;

    await openWorkspaceFile(store, '/vault/note.ts', async () => 'application/typescript');

    const tab = store.getState().tabs[0];
    expect(tab?.layout.kind).toBe('split');
    if (!tab || !isSplit(tab.layout)) {
      throw new Error('expected a split layout after opening the first file');
    }

    expect(tab.layout.orientation).toBe('row');
    expect(tab.layout.ratio).toBe(FILE_PANE_SPLIT_RATIO);

    if (!isStack(tab.layout.a) || !isStack(tab.layout.b)) {
      throw new Error('expected two stacks under the split');
    }

    expect(tab.layout.a.paneIds).toEqual([chatPaneId]);

    const filePaneId = getPanelIdForPath('file', '/vault/note.ts');
    expect(tab.layout.b.paneIds).toEqual([filePaneId]);
    expect(tab.panes[filePaneId]?.data).toEqual({
      kind: 'file',
      path: '/vault/note.ts',
      mime: 'application/typescript',
    });
    expect(tab.activePaneId).toBe(filePaneId);
  });

  it('replaces the existing FilePane in place when a second file opens (same pane, new content)', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/first.md', async () => 'text/markdown');
    const firstFilePaneId = getPanelIdForPath('file', '/vault/first.md');

    await openWorkspaceFile(store, '/vault/second.md', async () => 'text/markdown');

    const tab = store.getState().tabs[0];
    if (!tab || !isSplit(tab.layout)) {
      throw new Error('expected the split layout to persist');
    }

    expect(tab.layout.ratio).toBe(FILE_PANE_SPLIT_RATIO);
    if (!isStack(tab.layout.b)) {
      throw new Error('expected a right-side stack');
    }

    // Same paneId, same stack position — only data + title swap.
    expect(tab.layout.b.paneIds).toEqual([firstFilePaneId]);
    const replaced = tab.panes[firstFilePaneId];
    expect(replaced?.data).toEqual({
      kind: 'file',
      path: '/vault/second.md',
      mime: 'text/markdown',
    });
    expect(replaced?.title).toBe('second.md');
  });

  it('keeps Chat state and the split when the second file is the one already open', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/first.md', async () => 'text/markdown');
    const chatStackBefore = (() => {
      const tab = store.getState().tabs[0];
      if (!tab || !isSplit(tab.layout) || !isStack(tab.layout.a)) return null;
      return tab.layout.a.id;
    })();

    await openWorkspaceFile(store, '/vault/first.md', async () => 'text/markdown');

    const tab = store.getState().tabs[0];
    if (!tab || !isSplit(tab.layout) || !isStack(tab.layout.a)) {
      throw new Error('expected the split layout to persist');
    }

    expect(tab.layout.a.id).toBe(chatStackBefore);
  });

  it('collapses the split back to a single Chat pane when the FilePane is closed', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/note.ts', async () => 'application/typescript');

    const splitTab = store.getState().tabs[0];
    if (!splitTab) {
      throw new Error('expected a tab after opening a file');
    }

    const filePaneId = getPanelIdForPath('file', '/vault/note.ts');
    store.getState().actions.closePane(splitTab.id, filePaneId);

    const collapsedTab = store.getState().tabs[0];
    if (!collapsedTab) {
      throw new Error('expected the chat tab to remain after closing the FilePane');
    }

    expect(collapsedTab.layout.kind).toBe('stack');
    if (!isStack(collapsedTab.layout)) {
      throw new Error('expected a stack layout after collapse');
    }

    expect(collapsedTab.layout.paneIds).toHaveLength(1);
    const remainingPaneId = collapsedTab.layout.paneIds[0];
    if (!remainingPaneId) {
      throw new Error('expected a remaining pane id');
    }

    expect(collapsedTab.panes[remainingPaneId]?.kind).toBe('chat');
  });

  it('preserves a user-adjusted split ratio in the workspace snapshot', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/note.ts', async () => 'application/typescript');

    const tabBefore = store.getState().tabs[0];
    if (!tabBefore || !isSplit(tabBefore.layout)) {
      throw new Error('expected a split layout after opening a file');
    }

    const splitId = tabBefore.layout.id;
    store.getState().actions.setSplitRatio(tabBefore.id, splitId, 0.72);

    const tabAfter = store.getState().tabs[0];
    if (!tabAfter || !isSplit(tabAfter.layout)) {
      throw new Error('expected the split layout to persist after ratio change');
    }

    expect(tabAfter.layout.ratio).toBeCloseTo(0.72, 5);
  });

  it('round-trips the user-adjusted split ratio through the workspace snapshot (reload persistence)', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/note.ts', async () => 'application/typescript');

    const tabBefore = store.getState().tabs[0];
    if (!tabBefore || !isSplit(tabBefore.layout)) {
      throw new Error('expected a split layout after opening a file');
    }
    store.getState().actions.setSplitRatio(tabBefore.id, tabBefore.layout.id, 0.72);

    const snapshot = selectWorkspaceSnapshot(store.getState());

    const reloaded = createWorkspaceStore<TinkerPaneData>();
    reloaded.getState().actions.hydrate(snapshot);

    const restoredTab = reloaded.getState().tabs[0];
    if (!restoredTab || !isSplit(restoredTab.layout)) {
      throw new Error('expected a split layout to survive snapshot → hydrate');
    }
    expect(restoredTab.layout.ratio).toBeCloseTo(0.72, 5);
  });

  it('creates a workspace tab when file opens into an empty store', async () => {
    const store = createWorkspaceStore<TinkerPaneData>();

    await openWorkspaceFile(store, '/vault/readme.md', async () => 'text/markdown');

    expect(store.getState().tabs).toHaveLength(1);
    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/readme.md')]?.data).toEqual({
      kind: 'file',
      path: '/vault/readme.md',
      mime: 'text/markdown',
    });
  });

  it('infers spreadsheet mime for xlsx files', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/roadmap.xlsx', async () => XLSX_MIME);

    const activeTab = store.getState().tabs[0];
    expect(activeTab?.panes[getPanelIdForPath('file', '/vault/roadmap.xlsx')]?.data).toEqual({
      kind: 'file',
      path: '/vault/roadmap.xlsx',
      mime: XLSX_MIME,
    });
  });

  it('updates an existing pane when MIME resolution becomes more specific', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });
    const tabId = store.getState().activeTabId;
    if (!tabId) {
      throw new Error('expected an active workspace tab');
    }

    store.getState().actions.addPane(tabId, {
      id: getPanelIdForPath('file', '/vault/report'),
      kind: 'file',
      title: 'report',
      data: {
        kind: 'file',
        path: '/vault/report',
        mime: 'application/octet-stream',
      },
    });

    await openWorkspaceFile(store, '/vault/report', async () => 'application/pdf');

    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/report')]?.data).toEqual({
      kind: 'file',
      path: '/vault/report',
      mime: 'application/pdf',
    });
  });

  it('opens missing files into the friendly missing-file pane', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/missing.md', async () => MISSING_FILE_MIME);

    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/missing.md')]?.data).toEqual({
      kind: 'file',
      path: '/vault/missing.md',
      mime: MISSING_FILE_MIME,
    });
  });

  it('opens pptx files with the presentation MIME so FilePane can show the fallback renderer', async () => {
    const store = createWorkspaceStore<TinkerPaneData>();

    await openWorkspaceFile(
      store,
      '/vault/deck.pptx',
      async () => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );

    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/deck.pptx')]?.data).toEqual({
      kind: 'file',
      path: '/vault/deck.pptx',
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
  });

  it('opens xlsx files with the spreadsheet MIME so FilePane routes them through the workbook renderer', async () => {
    const store = createWorkspaceStore<TinkerPaneData>();

    await openWorkspaceFile(store, '/vault/roadmap.xlsx', async () => XLSX_MIME);

    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/roadmap.xlsx')]?.data).toEqual({
      kind: 'file',
      path: '/vault/roadmap.xlsx',
      mime: XLSX_MIME,
    });
  });
});
