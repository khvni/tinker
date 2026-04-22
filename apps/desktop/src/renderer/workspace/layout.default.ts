import type { WorkspaceState } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';

const createId = (prefix: string): string => {
  return `${prefix}-${crypto.randomUUID()}`;
};

export const createDefaultWorkspaceState = (): WorkspaceState<TinkerPaneData> => {
  const tabId = createId('tab');
  const stackId = createId('stack');
  const paneId = createId('pane');

  return {
    version: 2,
    tabs: [
      {
        id: tabId,
        createdAt: Date.now(),
        layout: {
          kind: 'stack',
          id: stackId,
          paneIds: [paneId],
          activePaneId: paneId,
        },
        panes: {
          [paneId]: {
            id: paneId,
            kind: 'chat',
            title: 'Chat',
            data: { kind: 'chat' },
          },
        },
        activePaneId: paneId,
        activeStackId: stackId,
      },
    ],
    activeTabId: tabId,
  };
};
