import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATIO,
  branchFromEdge,
  clampRatio,
  collectPaneIds,
  findPanePath,
  firstPaneId,
  getSpatialNeighborPaneId,
  isLeaf,
  leaf,
  nodeAtPath,
  orientationFromEdge,
  removePaneFromLayout,
  replaceAtPath,
  setRatioAtPath,
  splitAtPath,
} from './layout.js';
import type { LayoutNode } from '../../types.js';

const seed: LayoutNode = {
  kind: 'split',
  orientation: 'row',
  a: leaf('chat'),
  b: {
    kind: 'split',
    orientation: 'column',
    a: leaf('today'),
    b: leaf('vault'),
    ratio: 0.6,
  },
  ratio: 0.3,
};

describe('clampRatio', () => {
  it('clamps to 0.1 / 0.9', () => {
    expect(clampRatio(0)).toBe(0.1);
    expect(clampRatio(1)).toBe(0.9);
    expect(clampRatio(0.5)).toBe(0.5);
  });
  it('defaults NaN', () => {
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_RATIO);
  });
});

describe('orientationFromEdge / branchFromEdge', () => {
  it('maps edges to orientation + branch', () => {
    expect(orientationFromEdge('left')).toBe('row');
    expect(orientationFromEdge('right')).toBe('row');
    expect(orientationFromEdge('top')).toBe('column');
    expect(orientationFromEdge('bottom')).toBe('column');
    expect(branchFromEdge('left')).toBe('a');
    expect(branchFromEdge('top')).toBe('a');
    expect(branchFromEdge('right')).toBe('b');
    expect(branchFromEdge('bottom')).toBe('b');
  });
});

describe('leaf / isLeaf', () => {
  it('round-trips', () => {
    const node = leaf('x');
    expect(isLeaf(node)).toBe(true);
    expect(isLeaf(seed)).toBe(false);
  });
});

describe('collectPaneIds', () => {
  it('visits leaves in DFS order', () => {
    expect(collectPaneIds(seed)).toEqual(['chat', 'today', 'vault']);
  });
});

describe('findPanePath', () => {
  it('returns empty array for root leaf', () => {
    expect(findPanePath(leaf('x'), 'x')).toEqual([]);
  });
  it('returns null when missing', () => {
    expect(findPanePath(seed, 'missing')).toBeNull();
  });
  it('returns the correct branch path', () => {
    expect(findPanePath(seed, 'chat')).toEqual(['a']);
    expect(findPanePath(seed, 'today')).toEqual(['b', 'a']);
    expect(findPanePath(seed, 'vault')).toEqual(['b', 'b']);
  });
});

describe('nodeAtPath / replaceAtPath', () => {
  it('reads and replaces', () => {
    const node = nodeAtPath(seed, ['b', 'a']);
    expect(isLeaf(node) && node.paneId).toBe('today');
    const replaced = replaceAtPath(seed, ['b', 'a'], leaf('timeline'));
    expect(collectPaneIds(replaced)).toEqual(['chat', 'timeline', 'vault']);
  });
  it('throws when path descends into leaf', () => {
    expect(() => nodeAtPath(leaf('x'), ['a'])).toThrow(/leaf/i);
    expect(() => replaceAtPath(leaf('x'), ['a'], leaf('y'))).toThrow(/leaf/i);
  });
});

describe('splitAtPath', () => {
  it('inserts a new leaf on the requested edge and clamps ratio', () => {
    const next = splitAtPath(seed, ['a'], leaf('notes'), 'right', 0.7);
    expect(collectPaneIds(next)).toEqual(['chat', 'notes', 'today', 'vault']);
    const insertedSplit = nodeAtPath(next, ['a']);
    if (insertedSplit.kind !== 'split') throw new Error('expected split');
    expect(insertedSplit.orientation).toBe('row');
    expect(insertedSplit.a.kind === 'leaf' && insertedSplit.a.paneId).toBe('chat');
    expect(insertedSplit.b.kind === 'leaf' && insertedSplit.b.paneId).toBe('notes');
    expect(insertedSplit.ratio).toBeCloseTo(0.7);
  });
  it('inserts on top / bottom edges with correct branch ordering', () => {
    const top = splitAtPath(leaf('a'), [], leaf('b'), 'top');
    if (top.kind !== 'split') throw new Error('expected split');
    expect(top.orientation).toBe('column');
    expect(top.a.kind === 'leaf' && top.a.paneId).toBe('b');
    expect(top.b.kind === 'leaf' && top.b.paneId).toBe('a');
  });
});

describe('removePaneFromLayout', () => {
  it('removes a leaf and collapses the parent', () => {
    const next = removePaneFromLayout(seed, 'today');
    if (!next) throw new Error('expected remaining layout');
    expect(collectPaneIds(next)).toEqual(['chat', 'vault']);
    const rightChild = nodeAtPath(next, ['b']);
    expect(rightChild.kind === 'leaf' && rightChild.paneId).toBe('vault');
  });
  it('returns null when the last pane is removed', () => {
    expect(removePaneFromLayout(leaf('only'), 'only')).toBeNull();
  });
});

describe('setRatioAtPath', () => {
  it('sets ratio on a split node', () => {
    const next = setRatioAtPath(seed, [], 0.8);
    if (next.kind !== 'split') throw new Error('expected split');
    expect(next.ratio).toBeCloseTo(0.8);
  });
  it('throws on a leaf', () => {
    expect(() => setRatioAtPath(leaf('x'), [], 0.5)).toThrow(/leaf/i);
  });
});

describe('firstPaneId', () => {
  it('returns deepest a-branch leaf first', () => {
    expect(firstPaneId(seed)).toBe('chat');
  });
});

describe('getSpatialNeighborPaneId', () => {
  const layout: LayoutNode = {
    kind: 'split',
    orientation: 'row',
    a: leaf('left'),
    b: {
      kind: 'split',
      orientation: 'column',
      a: leaf('topRight'),
      b: leaf('bottomRight'),
      ratio: 0.5,
    },
    ratio: 0.5,
  };

  it('finds right neighbor when available', () => {
    expect(getSpatialNeighborPaneId(layout, 'left', 'right')).toBe('topRight');
  });
  it('finds left neighbor', () => {
    expect(getSpatialNeighborPaneId(layout, 'topRight', 'left')).toBe('left');
  });
  it('finds down neighbor between split children', () => {
    expect(getSpatialNeighborPaneId(layout, 'topRight', 'down')).toBe('bottomRight');
    expect(getSpatialNeighborPaneId(layout, 'bottomRight', 'up')).toBe('topRight');
  });
  it('returns null when no neighbor', () => {
    expect(getSpatialNeighborPaneId(leaf('only'), 'only', 'right')).toBeNull();
    expect(getSpatialNeighborPaneId(layout, 'left', 'left')).toBeNull();
  });
});
