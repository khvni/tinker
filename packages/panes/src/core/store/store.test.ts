import { describe, expect, it } from 'vitest';
import { createWorkspaceStore } from './store.js';
import { isLeaf } from '../utils/layout.js';
import type { LayoutNode } from '../../types.js';

type Data = { readonly label: string };

const openDefault = () => {
  const store = createWorkspaceStore<Data>();
  store.getState().actions.openTab({
    id: 't1',
    pane: { id: 'p1', kind: 'chat', data: { label: 'chat' } },
  });
  return store;
};

describe('workspace store', () => {
  it('openTab sets active pane + tab', () => {
    const store = openDefault();
    const state = store.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe('t1');
    const tab = state.tabs[0];
    if (!tab) throw new Error('expected tab');
    expect(tab.activePaneId).toBe('p1');
    expect(isLeaf(tab.layout) && tab.layout.paneId).toBe('p1');
  });

  it('openTab is idempotent for same id', () => {
    const store = openDefault();
    store.getState().actions.openTab({
      id: 't1',
      pane: { id: 'p99', kind: 'today', data: { label: 'dup' } },
    });
    expect(store.getState().tabs).toHaveLength(1);
  });

  it('splitPane inserts a new pane + layout', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    const tab = store.getState().tabs[0];
    if (!tab) throw new Error('expected tab');
    expect(Object.keys(tab.panes).sort()).toEqual(['p1', 'p2']);
    expect(tab.activePaneId).toBe('p2');
    const layout = tab.layout as LayoutNode;
    if (layout.kind !== 'split') throw new Error('expected split');
    expect(layout.orientation).toBe('row');
  });

  it('splitPane rejects duplicate pane ids', () => {
    const store = openDefault();
    expect(() =>
      store.getState().actions.splitPane(
        't1',
        'p1',
        'right',
        { id: 'p1', kind: 'dup', data: { label: 'bad' } },
      ),
    ).toThrow(/already exists/);
  });

  it('closePane collapses parent + reassigns active pane', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    store.getState().actions.closePane('t1', 'p2');
    const tab = store.getState().tabs[0];
    if (!tab) throw new Error('expected tab');
    expect(Object.keys(tab.panes)).toEqual(['p1']);
    expect(tab.activePaneId).toBe('p1');
    expect(isLeaf(tab.layout) && tab.layout.paneId).toBe('p1');
  });

  it('closePane removes the tab when the last pane closes', () => {
    const store = openDefault();
    store.getState().actions.closePane('t1', 'p1');
    expect(store.getState().tabs).toHaveLength(0);
    expect(store.getState().activeTabId).toBeNull();
  });

  it('closeTab picks a neighbor tab as active', () => {
    const store = openDefault();
    store.getState().actions.openTab({
      id: 't2',
      pane: { id: 'p2', kind: 'today', data: { label: 't' } },
    });
    store.getState().actions.closeTab('t2');
    expect(store.getState().activeTabId).toBe('t1');
  });

  it('moveTab reorders tabs', () => {
    const store = openDefault();
    store.getState().actions.openTab({
      id: 't2',
      pane: { id: 'p2', kind: 'today', data: { label: 't' } },
    });
    store.getState().actions.openTab({
      id: 't3',
      pane: { id: 'p3', kind: 'scheduler', data: { label: 's' } },
    });
    store.getState().actions.moveTab('t3', 0);
    expect(store.getState().tabs.map((tab) => tab.id)).toEqual(['t3', 't1', 't2']);
  });

  it('setSplitRatio updates ratio on the right node', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    store.getState().actions.setSplitRatio('t1', [], 0.75);
    const tab = store.getState().tabs[0];
    if (!tab) throw new Error('expected tab');
    if (tab.layout.kind !== 'split') throw new Error('expected split');
    expect(tab.layout.ratio).toBeCloseTo(0.75);
  });

  it('updatePaneData mutates only the target pane', () => {
    const store = openDefault();
    store.getState().actions.updatePaneData('t1', 'p1', (prev) => ({ label: `${prev.label}!` }));
    const tab = store.getState().tabs[0];
    if (!tab) throw new Error('expected tab');
    expect(tab.panes['p1']?.data.label).toBe('chat!');
  });

  it('hydrate replaces the entire state', () => {
    const store = openDefault();
    store.getState().actions.hydrate({
      version: 1,
      activeTabId: 'tA',
      tabs: [
        {
          id: 'tA',
          createdAt: 1,
          activePaneId: 'pA',
          layout: { kind: 'leaf', paneId: 'pA' },
          panes: { pA: { id: 'pA', kind: 'chat', data: { label: 'hydrated' } } },
        },
      ],
    });
    expect(store.getState().activeTabId).toBe('tA');
    expect(store.getState().tabs[0]?.panes['pA']?.data.label).toBe('hydrated');
  });

  it('movePane relocates without changing pane id or data', () => {
    const store = openDefault();
    const originalData = store.getState().tabs[0]?.panes['p1']?.data;
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    store.getState().actions.splitPane(
      't1',
      'p2',
      'bottom',
      { id: 'p3', kind: 'timer', data: { label: 'timer' } },
    );

    const before = store.getState().tabs[0];
    if (!before) throw new Error('tab');
    expect(Object.keys(before.panes).sort()).toEqual(['p1', 'p2', 'p3']);

    store.getState().actions.movePane('t1', 'p1', 'p3', 'left');

    const after = store.getState().tabs[0];
    if (!after) throw new Error('tab after');
    // Same panes (no id churn).
    expect(Object.keys(after.panes).sort()).toEqual(['p1', 'p2', 'p3']);
    // Data ref preserved — no copy.
    expect(after.panes['p1']?.data).toBe(originalData);
    // Active is the moved pane.
    expect(after.activePaneId).toBe('p1');
    // Layout tree changed (different structure than before).
    expect(JSON.stringify(after.layout)).not.toBe(JSON.stringify(before.layout));
  });

  it('movePane is a no-op when source equals target', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    const before = JSON.stringify(store.getState().tabs[0]);
    store.getState().actions.movePane('t1', 'p1', 'p1', 'right');
    const after = JSON.stringify(store.getState().tabs[0]);
    expect(after).toBe(before);
  });

  it('movePane does nothing when target is unknown', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    const before = JSON.stringify(store.getState().tabs[0]);
    store.getState().actions.movePane('t1', 'p1', 'missing', 'left');
    expect(JSON.stringify(store.getState().tabs[0])).toBe(before);
  });

  it('movePane collapses the source parent after removal', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    store.getState().actions.splitPane(
      't1',
      'p2',
      'bottom',
      { id: 'p3', kind: 'timer', data: { label: 'timer' } },
    );
    // Move p2 next to p1 (left side). p3 should promote out of the column split.
    store.getState().actions.movePane('t1', 'p2', 'p1', 'top');
    const layout = store.getState().tabs[0]?.layout;
    if (!layout) throw new Error('layout');
    // p3 should no longer live inside a split with a dead sibling — must be a leaf at some level.
    const stringified = JSON.stringify(layout);
    expect(stringified).toContain('"paneId":"p3"');
    // No orphan empty splits: every split node has both branches non-empty (invariant).
    const hasEmptyBranch = /"a":null|"b":null/.test(stringified);
    expect(hasEmptyBranch).toBe(false);
  });

  it('focusNeighbor moves focus within active tab', () => {
    const store = openDefault();
    store.getState().actions.splitPane(
      't1',
      'p1',
      'right',
      { id: 'p2', kind: 'today', data: { label: 'today' } },
    );
    store.getState().actions.focusPane('t1', 'p1');
    const next = store.getState().actions.focusNeighbor('right');
    expect(next).toBe('p2');
    expect(store.getState().tabs[0]?.activePaneId).toBe('p2');
  });
});
