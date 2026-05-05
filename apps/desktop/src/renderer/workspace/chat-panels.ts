import { Actions, DockLocation, type Model } from 'flexlayout-react';

const CHAT_PANEL_PATTERN = /^chat(?:-(\d+))?$/u;

const getChatPanelIndex = (panelId: string): number | null => {
  const match = panelId.match(CHAT_PANEL_PATTERN);
  if (!match) {
    return null;
  }

  return match[1] ? Number(match[1]) : 1;
};

export const getNextChatPanelId = (panelIds: string[]): string => {
  const nextIndex = panelIds.reduce((highest, panelId) => {
    const index = getChatPanelIndex(panelId);
    return index && index > highest ? index : highest;
  }, 0);

  return nextIndex === 0 ? 'chat' : `chat-${nextIndex + 1}`;
};

export const getChatPanelTitle = (panelId: string): string => {
  const index = getChatPanelIndex(panelId);
  return index && index > 1 ? `Chat ${index}` : 'Chat';
};

export const collectTabIds = (model: Model): string[] => {
  const ids: string[] = [];
  model.visitNodes((node) => {
    if (node.getType() === 'tab') {
      ids.push(node.getId());
    }
  });
  return ids;
};

export const openNewChatPanel = (model: Model): void => {
  const panelId = getNextChatPanelId(collectTabIds(model));
  const activeTabset = model.getActiveTabset();
  const firstTabset = model.getFirstTabSet();

  if (!activeTabset && !firstTabset) {
    console.warn('Cannot open a new chat panel because the workspace has no tabsets.');
    return;
  }

  const targetId = activeTabset?.getId() ?? firstTabset.getId();

  model.doAction(
    Actions.addTab(
      {
        type: 'tab',
        id: panelId,
        name: getChatPanelTitle(panelId),
        component: 'chat',
        config: { kind: 'chat' as const },
      },
      targetId,
      DockLocation.CENTER,
      -1,
      true,
    ),
  );
};
