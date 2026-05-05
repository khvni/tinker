import { describe, expect, it } from 'vitest';
import { Model } from 'flexlayout-react';
import { getChatPanelTitle, getNextChatPanelId, openNewChatPanel, collectTabIds } from './chat-panels.js';
import { createDefaultLayoutJson } from './layout.default.js';

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

  it('opens a new chat pane in the active tabset', () => {
    const model = Model.fromJson(createDefaultLayoutJson());

    openNewChatPanel(model);

    const ids = collectTabIds(model);
    expect(ids).toContain('chat');

    const chatNode = model.getNodeById('chat');
    expect(chatNode).toBeDefined();
  });

  it('adds a chat tab to an empty model', () => {
    const model = Model.fromJson({
      global: {},
      borders: [],
      layout: {
        type: 'row',
        weight: 100,
        children: [
          {
            type: 'tabset',
            weight: 100,
            children: [],
          },
        ],
      },
    });

    openNewChatPanel(model);

    const ids = collectTabIds(model);
    expect(ids).toContain('chat');
  });
});
