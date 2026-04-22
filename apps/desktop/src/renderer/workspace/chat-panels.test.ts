import { describe, expect, it } from 'vitest';
import { createWorkspaceStore } from '@tinker/panes';
import { getChatPanelTitle, getNextChatPanelId, openNewChatPanel } from './chat-panels.js';
import { createDefaultWorkspaceState } from './layout.default.js';
import type { TinkerPaneData } from '@tinker/shared-types';

describe('chat panel helpers', () => {
  it('allocates stable incrementing chat ids', () => {
    expect(getNextChatPanelId([])).toBe('chat');
    expect(getNextChatPanelId(['chat'])).toBe('chat-2');
    expect(getNextChatPanelId(['chat', 'chat-3'])).toBe('chat-4');
  });

  it('derives readable titles from panel ids', () => {
    expect(getChatPanelTitle('chat')).toBe('Chat');
    expect(getChatPanelTitle('chat-2')).toBe('Chat 2');
  });

  it('opens a new chat pane in the active workspace tab', () => {
    const store = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });

    openNewChatPanel(store);

    const activeTab = store.getState().tabs[0];
    expect(activeTab).toBeDefined();
    expect(activeTab?.activePaneId).toBe('chat');
    expect(Object.keys(activeTab?.panes ?? {})).toContain('chat');
    expect(activeTab?.panes.chat?.data).toEqual({ kind: 'chat' });
  });

  it('creates a workspace tab when none exist yet', () => {
    const store = createWorkspaceStore<TinkerPaneData>();

    openNewChatPanel(store);

    expect(store.getState().tabs).toHaveLength(1);
    expect(store.getState().tabs[0]?.activePaneId).toBe('chat');
  });
});
