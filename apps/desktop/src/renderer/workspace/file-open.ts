import type { TabKind } from '@tinker/shared-types';
import { getTabKindForPath, getPanelIdForPath, getPanelTitleForPath } from '../renderers/file-utils.js';

type WorkspacePanel = {
  id: string;
  api: {
    updateParameters(params: { path: string }): void;
    setActive(): void;
  };
};

type WorkspaceDockviewApi = {
  activePanel: { id: string } | null | undefined;
  panels: WorkspacePanel[];
  addPanel(panel: {
    id: string;
    component: TabKind;
    title: string;
    params: { path: string };
    position?: {
      referencePanel: string;
      direction: 'right';
    };
  }): void;
};

const getReferencePanelId = (api: WorkspaceDockviewApi): string | null => {
  return api.activePanel?.id ?? api.panels[0]?.id ?? null;
};

export const openWorkspaceFile = (api: WorkspaceDockviewApi, absolutePath: string): void => {
  const component = getTabKindForPath(absolutePath);
  const panelId = getPanelIdForPath(component, absolutePath);
  const existingPanel = api.panels.find((panel) => panel.id === panelId);

  if (existingPanel) {
    existingPanel.api.updateParameters({ path: absolutePath });
    existingPanel.api.setActive();
    return;
  }

  const referencePanelId = getReferencePanelId(api);
  api.addPanel({
    id: panelId,
    component,
    title: getPanelTitleForPath(absolutePath),
    params: { path: absolutePath },
    ...(referencePanelId
      ? {
          position: {
            referencePanel: referencePanelId,
            direction: 'right' as const,
          },
        }
      : {}),
  });
};
