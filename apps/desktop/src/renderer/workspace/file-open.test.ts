import { Model, type TabNode } from 'flexlayout-react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { describe, expect, it } from 'vitest';
import { MISSING_FILE_MIME } from '../panes/FilePane/index.js';
import { getPanelIdForPath, XLSX_MIME } from '../renderers/file-utils.js';
import { openWorkspaceFile } from './file-open.js';
import { createDefaultLayoutJson } from './layout.default.js';

const findTabById = (model: Model, id: string): TabNode | null => {
  const node = model.getNodeById(id);
  if (node && node.getType() === 'tab') return node as TabNode;
  return null;
};

describe('openWorkspaceFile', () => {
  it('focuses an existing file pane instead of opening a duplicate', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/note.ts', async () => 'application/typescript');

    const filePaneId = getPanelIdForPath('file', '/vault/note.ts');
    const fileNode = findTabById(model, filePaneId);
    expect(fileNode).toBeDefined();

    await openWorkspaceFile(model, '/vault/note.ts', async () => 'application/typescript');

    const fileNode2 = findTabById(model, filePaneId);
    expect(fileNode2).toBeDefined();
    expect(fileNode2?.isSelected()).toBe(true);
  });

  it('opens a file pane in a new split (right dock)', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/note.ts', async () => 'application/typescript');

    const filePaneId = getPanelIdForPath('file', '/vault/note.ts');
    const fileNode = findTabById(model, filePaneId);
    expect(fileNode).toBeDefined();
    const config = fileNode?.getConfig() as TinkerPaneData;
    expect(config).toEqual({
      kind: 'file',
      path: '/vault/note.ts',
      mime: 'application/typescript',
    });
  });

  it('replaces existing file pane content when a second file opens', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/first.md', async () => 'text/markdown');
    const firstPaneId = getPanelIdForPath('file', '/vault/first.md');
    const secondPaneId = getPanelIdForPath('file', '/vault/second.md');

    await openWorkspaceFile(model, '/vault/second.md', async () => 'text/markdown');

    expect(findTabById(model, firstPaneId)).toBeNull();
    const newNode = findTabById(model, secondPaneId);
    expect(newNode).toBeDefined();
    const config = newNode?.getConfig() as TinkerPaneData;
    expect(config).toEqual({
      kind: 'file',
      path: '/vault/second.md',
      mime: 'text/markdown',
    });
  });

  it('infers spreadsheet mime for xlsx files', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/roadmap.xlsx', async () => XLSX_MIME);

    const filePaneId = getPanelIdForPath('file', '/vault/roadmap.xlsx');
    const fileNode = findTabById(model, filePaneId);
    const config = fileNode?.getConfig() as TinkerPaneData;
    expect(config).toEqual({
      kind: 'file',
      path: '/vault/roadmap.xlsx',
      mime: XLSX_MIME,
    });
  });

  it('opens missing files into the friendly missing-file pane', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/missing.md', async () => MISSING_FILE_MIME);

    const filePaneId = getPanelIdForPath('file', '/vault/missing.md');
    const fileNode = findTabById(model, filePaneId);
    const config = fileNode?.getConfig() as TinkerPaneData;
    expect(config).toEqual({
      kind: 'file',
      path: '/vault/missing.md',
      mime: MISSING_FILE_MIME,
    });
  });

  it('updates an existing pane when MIME resolution becomes more specific', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/report', async () => 'application/octet-stream');

    await openWorkspaceFile(model, '/vault/report', async () => 'application/pdf');

    const filePaneId = getPanelIdForPath('file', '/vault/report');
    const fileNode = findTabById(model, filePaneId);
    const config = fileNode?.getConfig() as TinkerPaneData;
    expect(config).toEqual({
      kind: 'file',
      path: '/vault/report',
      mime: 'application/pdf',
    });
  });

  it('round-trips layout to JSON for persistence', async () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    await openWorkspaceFile(model, '/vault/note.ts', async () => 'application/typescript');

    const serialized = model.toJson();
    const restored = Model.fromJson(serialized);

    const filePaneId = getPanelIdForPath('file', '/vault/note.ts');
    const fileNode = findTabById(restored, filePaneId);
    expect(fileNode).toBeDefined();
    const config = fileNode?.getConfig() as TinkerPaneData;
    expect(config).toEqual({
      kind: 'file',
      path: '/vault/note.ts',
      mime: 'application/typescript',
    });
  });
});
