import type { WorkspaceStore } from '@tinker/panes';
import type { TinkerPaneData } from '@tinker/shared-types';

const CHAT_PANEL_PATTERN = /^chat(?:-(\d+))?$/u;

const getChatPanelIndex = (panelId: string): number | null => {
  const match = panelId.match(CHAT_PANEL_PATTERN);
  if (!match) {
    return null;
  }

  return match[1] ? Number(match[1]) : 1;
};

const createWorkspaceTabId = (): string => {
  return `workspace-${crypto.randomUUID()}`;
};

const createChatPane = (panelId: string) => {
  return {
    id: panelId,
    kind: 'chat',
    title: getChatPanelTitle(panelId),
    data: { kind: 'chat' } as const,
  };
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

export const openNewChatPanel = (store: WorkspaceStore<TinkerPaneData>): void => {
  const state = store.getState();
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
  const panelId = getNextChatPanelId(state.tabs.flatMap((tab) => Object.keys(tab.panes)));
  const pane = createChatPane(panelId);

  if (!activeTab) {
    state.actions.openTab({
      id: createWorkspaceTabId(),
      pane,
    });
    return;
  }

  state.actions.addPane(activeTab.id, pane, { activate: true });
};
