import { describe, expect, it } from 'vitest';
import { createDefaultWorkspaceState } from './layout.default.js';

describe('createDefaultWorkspaceState', () => {
  it('returns a single-chat workspace snapshot', () => {
    const state = createDefaultWorkspaceState();

    expect(state.version).toBe(2);
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(state.tabs[0]?.id ?? null);

    const tab = state.tabs[0];
    expect(tab?.layout.kind).toBe('stack');
    expect(Object.keys(tab?.panes ?? {})).toHaveLength(1);

    const pane = tab ? Object.values(tab.panes)[0] : null;
    expect(pane).toMatchObject({
      kind: 'chat',
      title: 'Chat',
      data: { kind: 'chat' },
    });
  });

  it('returns a fresh workspace snapshot each time', () => {
    const left = createDefaultWorkspaceState();
    const right = createDefaultWorkspaceState();

    expect(left.tabs[0]?.id).not.toBe(right.tabs[0]?.id);

    const leftPaneId = left.tabs[0] ? Object.keys(left.tabs[0].panes)[0] : null;
    const rightPaneId = right.tabs[0] ? Object.keys(right.tabs[0].panes)[0] : null;

    expect(leftPaneId).not.toBe(rightPaneId);
  });
});
