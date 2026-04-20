import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATIO,
  classifyBodyDrop,
  clampRatio,
  collapseEmptyStacks,
  collectPaneIds,
  collectStacks,
  findStack,
  findStackContainingPane,
  firstPaneId,
  firstStackId,
  getSpatialNeighborStackId,
  insertPaneInStack,
  isSplit,
  isStack,
  movePaneToStack,
  removePaneFromStack,
  reorderPaneInStack,
  replaceStack,
  setSplitRatioById,
  splitNode,
  splitStackOnEdge,
  stack,
} from './layout.js';

describe('clampRatio', () => {
  it('clamps below 0.1 up', () => expect(clampRatio(0)).toBe(0.1));
  it('clamps above 0.9 down', () => expect(clampRatio(1)).toBe(0.9));
  it('passes valid ratios through', () => expect(clampRatio(0.42)).toBe(0.42));
  it('falls back to default on NaN', () => expect(clampRatio(Number.NaN)).toBe(DEFAULT_RATIO));
});

describe('stack constructor', () => {
  it('defaults active to the first pane', () => {
    const s = stack(['a', 'b', 'c']);
    expect(s.activePaneId).toBe('a');
    expect(s.paneIds).toEqual(['a', 'b', 'c']);
  });
  it('respects explicit active', () => {
    const s = stack(['a', 'b'], 'b');
    expect(s.activePaneId).toBe('b');
  });
  it('clears active when empty', () => {
    const s = stack([]);
    expect(s.activePaneId).toBeNull();
  });
});

describe('insertPaneInStack', () => {
  it('appends to the end by default', () => {
    const s = stack(['a', 'b']);
    const next = insertPaneInStack(s, 'c');
    expect(next.paneIds).toEqual(['a', 'b', 'c']);
    expect(next.activePaneId).toBe('c');
  });
  it('inserts at a specific index', () => {
    const s = stack(['a', 'b', 'c']);
    const next = insertPaneInStack(s, 'x', 1);
    expect(next.paneIds).toEqual(['a', 'x', 'b', 'c']);
    expect(next.activePaneId).toBe('x');
  });
  it('reorders when the pane already exists in the stack', () => {
    const s = stack(['a', 'b', 'c']);
    const next = insertPaneInStack(s, 'a', 2);
    // reorder removes 'a' first → target index 2 applies to ['b','c'] → becomes ['b','c','a']
    expect(next.paneIds).toEqual(['b', 'c', 'a']);
  });
});

describe('reorderPaneInStack', () => {
  it('moves pane to a new index', () => {
    const s = stack(['a', 'b', 'c']);
    expect(reorderPaneInStack(s, 'a', 2).paneIds).toEqual(['b', 'c', 'a']);
  });
  it('is a no-op when pane is not in stack', () => {
    const s = stack(['a', 'b']);
    expect(reorderPaneInStack(s, 'z', 0)).toBe(s);
  });
});

describe('removePaneFromStack', () => {
  it('picks a nearby pane as new active', () => {
    const s = stack(['a', 'b', 'c'], 'b');
    const next = removePaneFromStack(s, 'b');
    expect(next.paneIds).toEqual(['a', 'c']);
    expect(next.activePaneId).toBe('c');
  });
  it('keeps active if a different pane is removed', () => {
    const s = stack(['a', 'b', 'c'], 'a');
    const next = removePaneFromStack(s, 'c');
    expect(next.activePaneId).toBe('a');
  });
  it('returns an empty stack when last pane is removed', () => {
    const next = removePaneFromStack(stack(['solo']), 'solo');
    expect(next.paneIds).toEqual([]);
    expect(next.activePaneId).toBeNull();
  });
});

describe('collapseEmptyStacks', () => {
  it('removes an empty leaf and returns sibling', () => {
    const left = stack([], null, 'empty-stack');
    const right = stack(['p1'], 'p1');
    const tree = splitNode(left, right, 'row');
    const collapsed = collapseEmptyStacks(tree);
    expect(collapsed).toBe(right);
  });
  it('returns null when the whole tree is empty', () => {
    const tree = stack([]);
    expect(collapseEmptyStacks(tree)).toBeNull();
  });
  it('recurses into nested splits', () => {
    const innerEmpty = stack([], null);
    const innerFull = stack(['keep']);
    const inner = splitNode(innerEmpty, innerFull, 'column');
    const outer = splitNode(inner, stack(['other']), 'row');
    const collapsed = collapseEmptyStacks(outer);
    expect(collapsed && !isStack(collapsed)).toBe(true);
  });
});

describe('splitStackOnEdge', () => {
  it('creates a new split with the new stack on the requested side', () => {
    const s = stack(['p1'], 'p1', 'orig');
    const newer = stack(['new'], 'new');
    const next = splitStackOnEdge(s, 'orig', 'right', newer);
    expect(isSplit(next)).toBe(true);
    if (isSplit(next)) {
      expect(next.orientation).toBe('row');
      expect(isStack(next.a) && next.a.paneIds).toEqual(['p1']);
      expect(isStack(next.b) && next.b.paneIds).toEqual(['new']);
    }
  });
  it('puts new stack on the A side for left edges', () => {
    const s = stack(['p1'], 'p1', 'orig');
    const newer = stack(['new'], 'new');
    const next = splitStackOnEdge(s, 'orig', 'left', newer);
    if (isSplit(next)) {
      expect(isStack(next.a) && next.a.paneIds).toEqual(['new']);
      expect(isStack(next.b) && next.b.paneIds).toEqual(['p1']);
    }
  });
});

describe('movePaneToStack — cross-stack', () => {
  const build = () => {
    const a = stack(['pa'], 'pa', 'stack-a');
    const b = stack(['pb'], 'pb', 'stack-b');
    return { root: splitNode(a, b, 'row', 0.5, 'split-root'), a, b };
  };

  it('merges into center of target', () => {
    const { root } = build();
    const result = movePaneToStack(root, 'pa', 'stack-b', { kind: 'center' });
    expect(result).not.toBeNull();
    const collapsed = result?.layout;
    expect(collapsed && isStack(collapsed)).toBe(true);
    if (collapsed && isStack(collapsed)) {
      expect(collapsed.paneIds).toEqual(['pb', 'pa']);
      expect(collapsed.id).toBe('stack-b');
    }
  });

  it('inserts at a specific tab position', () => {
    const a = stack(['pa'], 'pa', 'stack-a');
    const b = stack(['pb1', 'pb2'], 'pb1', 'stack-b');
    const root = splitNode(a, b, 'row');
    const result = movePaneToStack(root, 'pa', 'stack-b', { kind: 'insert', index: 1 });
    expect(result).not.toBeNull();
    const collapsed = result?.layout;
    if (collapsed && isStack(collapsed)) {
      expect(collapsed.paneIds).toEqual(['pb1', 'pa', 'pb2']);
    }
  });

  it('splits target stack when dropped on an edge', () => {
    const { root } = build();
    const result = movePaneToStack(root, 'pa', 'stack-b', { kind: 'edge', edge: 'right' });
    expect(result).not.toBeNull();
    const nextLayout = result?.layout;
    if (nextLayout && isSplit(nextLayout)) {
      expect(nextLayout.orientation).toBe('row');
      if (isStack(nextLayout.a)) expect(nextLayout.a.id).toBe('stack-b');
      if (isStack(nextLayout.b)) expect(nextLayout.b.paneIds).toEqual(['pa']);
    }
  });
});

describe('movePaneToStack — same stack', () => {
  it('reorders to a new index', () => {
    const s = stack(['a', 'b', 'c'], 'a', 'only');
    const result = movePaneToStack(s, 'a', 'only', { kind: 'insert', index: 2 });
    expect(result).not.toBeNull();
    if (result && isStack(result.layout)) {
      expect(result.layout.paneIds).toEqual(['b', 'c', 'a']);
    }
  });
  it('splits off a pane into a new sibling stack when dropped on edge', () => {
    const s = stack(['a', 'b'], 'a', 'only');
    const result = movePaneToStack(s, 'a', 'only', { kind: 'edge', edge: 'bottom' });
    expect(result).not.toBeNull();
    if (result && isSplit(result.layout)) {
      expect(result.layout.orientation).toBe('column');
      if (isStack(result.layout.a)) expect(result.layout.a.paneIds).toEqual(['b']);
      if (isStack(result.layout.b)) expect(result.layout.b.paneIds).toEqual(['a']);
    }
  });
  it('refuses to split when the source is the only pane', () => {
    const s = stack(['solo'], 'solo', 'only');
    expect(movePaneToStack(s, 'solo', 'only', { kind: 'edge', edge: 'right' })).toBeNull();
  });
});

describe('setSplitRatioById', () => {
  it('updates the ratio for the matching split', () => {
    const left = stack(['a'], 'a');
    const right = stack(['b'], 'b');
    const root = splitNode(left, right, 'row', 0.5, 'target');
    const next = setSplitRatioById(root, 'target', 0.75);
    if (isSplit(next)) expect(next.ratio).toBe(0.75);
  });
  it('leaves unrelated splits alone', () => {
    const leaf1 = stack(['a'], 'a');
    const leaf2 = stack(['b'], 'b');
    const root = splitNode(leaf1, leaf2, 'row', 0.5, 'target');
    const next = setSplitRatioById(root, 'other-id', 0.75);
    expect(next).toBe(root);
  });
});

describe('getSpatialNeighborStackId', () => {
  it('finds the stack to the right', () => {
    const left = stack(['a'], 'a', 'L');
    const right = stack(['b'], 'b', 'R');
    const root = splitNode(left, right, 'row', 0.5);
    expect(getSpatialNeighborStackId(root, 'L', 'right')).toBe('R');
    expect(getSpatialNeighborStackId(root, 'R', 'left')).toBe('L');
  });
  it('returns null when no neighbor exists', () => {
    const solo = stack(['a'], 'a', 'only');
    expect(getSpatialNeighborStackId(solo, 'only', 'up')).toBeNull();
  });
  it('navigates across nested splits', () => {
    const tl = stack(['tl'], 'tl', 'tl');
    const tr = stack(['tr'], 'tr', 'tr');
    const b = stack(['b'], 'b', 'b');
    const top = splitNode(tl, tr, 'row', 0.5);
    const root = splitNode(top, b, 'column', 0.5);
    expect(getSpatialNeighborStackId(root, 'tl', 'down')).toBe('b');
    expect(getSpatialNeighborStackId(root, 'tr', 'down')).toBe('b');
  });
});

describe('classifyBodyDrop', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  it('returns center when pointer is inside the inner 44% square', () => {
    expect(classifyBodyDrop(rect, 50, 50)).toEqual({ kind: 'center' });
  });
  it('returns left edge near the left border', () => {
    expect(classifyBodyDrop(rect, 5, 50)).toEqual({ kind: 'edge', edge: 'left' });
  });
  it('returns right edge near the right border', () => {
    expect(classifyBodyDrop(rect, 95, 50)).toEqual({ kind: 'edge', edge: 'right' });
  });
  it('returns top edge near the top border', () => {
    expect(classifyBodyDrop(rect, 50, 5)).toEqual({ kind: 'edge', edge: 'top' });
  });
  it('returns bottom edge near the bottom border', () => {
    expect(classifyBodyDrop(rect, 50, 95)).toEqual({ kind: 'edge', edge: 'bottom' });
  });
  it('returns null when rect has zero size', () => {
    expect(classifyBodyDrop({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBeNull();
  });
});

describe('traversal helpers', () => {
  it('collectStacks walks every leaf', () => {
    const layout = splitNode(stack(['a'], 'a'), splitNode(stack(['b'], 'b'), stack(['c'], 'c'), 'row'), 'column');
    const all = collectStacks(layout);
    expect(all.length).toBe(3);
  });
  it('collectPaneIds flattens ids', () => {
    const layout = splitNode(stack(['a', 'b'], 'a'), stack(['c'], 'c'), 'row');
    expect(collectPaneIds(layout)).toEqual(['a', 'b', 'c']);
  });
  it('findStack + findStackContainingPane work', () => {
    const s = stack(['a', 'b'], 'a', 'my-stack');
    expect(findStack(s, 'my-stack')).toBe(s);
    expect(findStackContainingPane(s, 'b')).toBe(s);
    expect(findStackContainingPane(s, 'not-there')).toBeNull();
  });
  it('firstStackId + firstPaneId traverse left-first', () => {
    const layout = splitNode(stack(['a'], 'a', 's1'), stack(['b'], 'b', 's2'), 'row');
    expect(firstStackId(layout)).toBe('s1');
    expect(firstPaneId(layout)).toBe('a');
  });
  it('replaceStack swaps a node', () => {
    const s = stack(['a'], 'a', 'orig');
    const other = splitNode(stack(['x'], 'x'), stack(['y'], 'y'), 'row');
    const next = replaceStack(s, 'orig', other);
    expect(next).toBe(other);
  });
});
