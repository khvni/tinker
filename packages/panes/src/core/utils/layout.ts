import type { DropEdge, FocusDirection, LayoutNode, SplitBranch, SplitOrientation, SplitPath } from '../../types.js';

const RATIO_MIN = 0.1;
const RATIO_MAX = 0.9;

export const DEFAULT_RATIO = 0.5;

export const clampRatio = (ratio: number): number => {
  if (Number.isNaN(ratio)) return DEFAULT_RATIO;
  if (ratio < RATIO_MIN) return RATIO_MIN;
  if (ratio > RATIO_MAX) return RATIO_MAX;
  return ratio;
};

export const leaf = (paneId: string): LayoutNode => ({ kind: 'leaf', paneId });

export const isLeaf = (node: LayoutNode): node is Extract<LayoutNode, { kind: 'leaf' }> => {
  return node.kind === 'leaf';
};

export const orientationFromEdge = (edge: DropEdge): SplitOrientation => {
  return edge === 'left' || edge === 'right' ? 'row' : 'column';
};

export const branchFromEdge = (edge: DropEdge): SplitBranch => {
  return edge === 'left' || edge === 'top' ? 'a' : 'b';
};

export const collectPaneIds = (node: LayoutNode): ReadonlyArray<string> => {
  if (isLeaf(node)) return [node.paneId];
  return [...collectPaneIds(node.a), ...collectPaneIds(node.b)];
};

export const findPanePath = (node: LayoutNode, paneId: string): SplitPath | null => {
  if (isLeaf(node)) {
    return node.paneId === paneId ? [] : null;
  }
  const a = findPanePath(node.a, paneId);
  if (a) return ['a', ...a];
  const b = findPanePath(node.b, paneId);
  if (b) return ['b', ...b];
  return null;
};

export const replaceAtPath = (node: LayoutNode, path: SplitPath, replacement: LayoutNode): LayoutNode => {
  if (path.length === 0) return replacement;
  if (isLeaf(node)) {
    throw new Error(`Cannot descend into leaf while replacing at path ${path.join('/')}`);
  }
  const [head, ...rest] = path;
  if (head === 'a') {
    return { ...node, a: replaceAtPath(node.a, rest, replacement) };
  }
  return { ...node, b: replaceAtPath(node.b, rest, replacement) };
};

export const splitAtPath = (
  node: LayoutNode,
  path: SplitPath,
  neighbor: LayoutNode,
  edge: DropEdge,
  ratio: number = DEFAULT_RATIO,
): LayoutNode => {
  const target = nodeAtPath(node, path);
  const orientation = orientationFromEdge(edge);
  const newBranch = branchFromEdge(edge);
  const split: LayoutNode =
    newBranch === 'a'
      ? { kind: 'split', orientation, a: neighbor, b: target, ratio: clampRatio(ratio) }
      : { kind: 'split', orientation, a: target, b: neighbor, ratio: clampRatio(ratio) };
  return replaceAtPath(node, path, split);
};

export const nodeAtPath = (node: LayoutNode, path: SplitPath): LayoutNode => {
  if (path.length === 0) return node;
  if (isLeaf(node)) {
    throw new Error(`Path ${path.join('/')} descends into a leaf`);
  }
  const [head, ...rest] = path;
  return nodeAtPath(head === 'a' ? node.a : node.b, rest);
};

/**
 * Remove a pane leaf. Returns a new layout tree or `null` if the tab would be
 * empty (caller should then remove the tab entirely).
 */
export const removePaneFromLayout = (node: LayoutNode, paneId: string): LayoutNode | null => {
  if (isLeaf(node)) {
    return node.paneId === paneId ? null : node;
  }
  const a = removePaneFromLayout(node.a, paneId);
  const b = removePaneFromLayout(node.b, paneId);
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return { ...node, a, b };
};

export const setRatioAtPath = (node: LayoutNode, path: SplitPath, ratio: number): LayoutNode => {
  const target = nodeAtPath(node, path);
  if (isLeaf(target)) {
    throw new Error('Cannot set ratio on a leaf node');
  }
  return replaceAtPath(node, path, { ...target, ratio: clampRatio(ratio) });
};

/** Return the first pane id encountered in a left-first DFS. */
export const firstPaneId = (node: LayoutNode): string | null => {
  if (isLeaf(node)) return node.paneId;
  return firstPaneId(node.a) ?? firstPaneId(node.b);
};

type SpatialRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

type SpatialEntry = { readonly paneId: string; readonly rect: SpatialRect };

const collectSpatialLayout = (
  node: LayoutNode,
  rect: SpatialRect,
  out: Array<SpatialEntry>,
): void => {
  if (isLeaf(node)) {
    out.push({ paneId: node.paneId, rect });
    return;
  }
  const ratio = clampRatio(node.ratio ?? DEFAULT_RATIO);
  if (node.orientation === 'row') {
    const widthA = rect.width * ratio;
    collectSpatialLayout(node.a, { ...rect, width: widthA }, out);
    collectSpatialLayout(node.b, { x: rect.x + widthA, y: rect.y, width: rect.width - widthA, height: rect.height }, out);
  } else {
    const heightA = rect.height * ratio;
    collectSpatialLayout(node.a, { ...rect, height: heightA }, out);
    collectSpatialLayout(node.b, { x: rect.x, y: rect.y + heightA, width: rect.width, height: rect.height - heightA }, out);
  }
};

/**
 * Spatial neighbor lookup. Given a pane and a focus direction, returns the id
 * of the nearest pane whose rect overlaps in the perpendicular axis and lies in
 * the requested direction. Returns `null` when there is no neighbor.
 *
 * Works on a unit square since all we care about is relative ordering.
 */
export const getSpatialNeighborPaneId = (
  layout: LayoutNode,
  originPaneId: string,
  direction: FocusDirection,
): string | null => {
  const entries: Array<SpatialEntry> = [];
  collectSpatialLayout(layout, { x: 0, y: 0, width: 1, height: 1 }, entries);
  const origin = entries.find((entry) => entry.paneId === originPaneId);
  if (!origin) return null;

  const candidates = entries.filter((entry) => entry.paneId !== originPaneId);

  const lies = (entry: SpatialEntry): boolean => {
    const { rect } = entry;
    switch (direction) {
      case 'left':
        return rect.x + rect.width <= origin.rect.x + 1e-6;
      case 'right':
        return rect.x >= origin.rect.x + origin.rect.width - 1e-6;
      case 'up':
        return rect.y + rect.height <= origin.rect.y + 1e-6;
      case 'down':
        return rect.y >= origin.rect.y + origin.rect.height - 1e-6;
    }
  };

  const overlaps = (entry: SpatialEntry): boolean => {
    const { rect } = entry;
    if (direction === 'left' || direction === 'right') {
      return rect.y < origin.rect.y + origin.rect.height && rect.y + rect.height > origin.rect.y;
    }
    return rect.x < origin.rect.x + origin.rect.width && rect.x + rect.width > origin.rect.x;
  };

  const distance = (entry: SpatialEntry): number => {
    const { rect } = entry;
    switch (direction) {
      case 'left':
        return origin.rect.x - (rect.x + rect.width);
      case 'right':
        return rect.x - (origin.rect.x + origin.rect.width);
      case 'up':
        return origin.rect.y - (rect.y + rect.height);
      case 'down':
        return rect.y - (origin.rect.y + origin.rect.height);
    }
  };

  const eligible = candidates.filter((entry) => lies(entry) && overlaps(entry));
  if (eligible.length === 0) return null;

  eligible.sort((left, right) => distance(left) - distance(right));
  const first = eligible[0];
  return first ? first.paneId : null;
};
