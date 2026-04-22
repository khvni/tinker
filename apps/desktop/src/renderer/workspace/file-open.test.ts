import { createWorkspaceStore } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';
import { describe, expect, it } from 'vitest';
import { MISSING_FILE_MIME } from '../panes/FilePane/index.js';
import { getPanelIdForPath, XLSX_MIME } from '../renderers/file-utils.js';
import { openWorkspaceFile } from './file-open.js';
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

  it('creates a new file pane in the active workspace tab when none exists', async () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    await openWorkspaceFile(store, '/vault/note.ts', async () => 'application/typescript');

    const activeTab = store.getState().tabs[0];
    expect(activeTab?.panes[getPanelIdForPath('file', '/vault/note.ts')]?.data).toEqual({
      kind: 'file',
      path: '/vault/note.ts',
      mime: 'application/typescript',
    });
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
