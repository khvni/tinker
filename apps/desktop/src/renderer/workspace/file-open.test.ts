import { describe, expect, it } from 'vitest';
import { createWorkspaceStore } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';
import { getPanelIdForPath, XLSX_MIME } from '../renderers/file-utils.js';
import { openWorkspaceFile } from './file-open.js';
import { createDefaultWorkspaceState } from './layout.default.js';

describe('openWorkspaceFile', () => {
  it('focuses an existing file pane instead of opening a duplicate', () => {
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

    openWorkspaceFile(store, '/vault/note.ts');

    expect(store.getState().tabs[0]?.activePaneId).toBe(getPanelIdForPath('file', '/vault/note.ts'));
  });

  it('creates a new file pane in the active workspace tab when none exists', () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    openWorkspaceFile(store, '/vault/note.ts');

    const activeTab = store.getState().tabs[0];
    expect(activeTab?.panes[getPanelIdForPath('file', '/vault/note.ts')]?.data).toEqual({
      kind: 'file',
      path: '/vault/note.ts',
      mime: 'application/typescript',
    });
  });

  it('creates a workspace tab when file opens into an empty store', () => {
    const store = createWorkspaceStore<TinkerPaneData>();

    openWorkspaceFile(store, '/vault/readme.md');

    expect(store.getState().tabs).toHaveLength(1);
    expect(store.getState().tabs[0]?.panes[getPanelIdForPath('file', '/vault/readme.md')]?.data).toEqual({
      kind: 'file',
      path: '/vault/readme.md',
      mime: 'text/markdown',
    });
  });

  it('infers spreadsheet mime for xlsx files', () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    openWorkspaceFile(store, '/vault/roadmap.xlsx');

    const activeTab = store.getState().tabs[0];
    expect(activeTab?.panes[getPanelIdForPath('file', '/vault/roadmap.xlsx')]?.data).toEqual({
      kind: 'file',
      path: '/vault/roadmap.xlsx',
      mime: XLSX_MIME,
    });
  });
});
