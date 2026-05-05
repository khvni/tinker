import { Actions, DockLocation, type Model, type TabNode } from 'flexlayout-react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { resolveFilePaneMime } from '../panes/FilePane/file-mime.js';
import {
  getPanelIdForPath,
  getPanelTitleForPath,
  isAbsolutePath,
} from '../renderers/file-utils.js';

export const FILE_PANE_SPLIT_RATIO = 0.6;

export type ResolveWorkspaceFileMime = (absolutePath: string) => Promise<string>;

type ExistingFilePane = {
  nodeId: string;
  data: Extract<TinkerPaneData, { readonly kind: 'file' }>;
};

const findFilePaneByPath = (
  model: Model,
  absolutePath: string,
): ExistingFilePane | null => {
  let found: ExistingFilePane | null = null;
  model.visitNodes((node) => {
    if (found) return;
    if (node.getType() !== 'tab') return;
    const tabNode = node as TabNode;
    const config = tabNode.getConfig() as TinkerPaneData | undefined;
    if (config?.kind === 'file' && config.path === absolutePath) {
      found = { nodeId: tabNode.getId(), data: config };
    }
  });
  return found;
};

const findFirstFilePane = (
  model: Model,
): TabNode | null => {
  let found: TabNode | null = null;
  model.visitNodes((node) => {
    if (found) return;
    if (node.getType() !== 'tab') return;
    const tabNode = node as TabNode;
    const config = tabNode.getConfig() as TinkerPaneData | undefined;
    if (config?.kind === 'file') {
      found = tabNode;
    }
  });
  return found;
};

export const openWorkspaceFile = async (
  model: Model,
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

  const samePathPane = findFilePaneByPath(model, absolutePath);
  if (samePathPane) {
    if (samePathPane.data.mime !== mime) {
      model.doAction(
        Actions.updateNodeAttributes(samePathPane.nodeId, {
          config: { ...samePathPane.data, mime },
        }),
      );
    }
    model.doAction(Actions.selectTab(samePathPane.nodeId));
    return;
  }

  const fileTabJson = {
    type: 'tab' as const,
    id: getPanelIdForPath('file', absolutePath),
    name: getPanelTitleForPath(absolutePath),
    component: 'file',
    config: {
      kind: 'file' as const,
      path: absolutePath,
      mime,
    },
  };

  const existingFilePane = findFirstFilePane(model);
  if (existingFilePane) {
    const tabsetId = existingFilePane.getParent()?.getId();
    model.doAction(Actions.deleteTab(existingFilePane.getId()));
    const targetId = tabsetId && model.getNodeById(tabsetId)
      ? tabsetId
      : model.getActiveTabset()?.getId() ?? model.getFirstTabSet().getId();
    model.doAction(
      Actions.addTab(
        fileTabJson,
        targetId,
        DockLocation.CENTER,
        -1,
        true,
      ),
    );
    return;
  }

  const activeTabset = model.getActiveTabset();
  if (activeTabset) {
    model.doAction(
      Actions.addTab(
        fileTabJson,
        activeTabset.getId(),
        DockLocation.RIGHT,
        -1,
        true,
      ),
    );
    return;
  }

  const firstTabset = model.getFirstTabSet();
  model.doAction(
    Actions.addTab(
      fileTabJson,
      firstTabset.getId(),
      DockLocation.CENTER,
      -1,
      true,
    ),
  );
};
