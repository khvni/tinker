import type {
  DropEdge,
  DropTarget,
  FocusDirection,
  LayoutNode,
  PaneId,
  SplitBranch,
  SplitNode,
  SplitOrientation,
  SplitPath,
  StackId,
  StackNode,
} from '../../types.js';

const RATIO_MIN = 0.1;
const RATIO_MAX = 0.9;

export const DEFAULT_RATIO = 0.5;

export const clampRatio = (ratio: number): number => {
  if (Number.isNaN(ratio)) return DEFAULT_RATIO;
  if (ratio < RATIO_MIN) return RATIO_MIN;
  if (ratio > RATIO_MAX) return RATIO_MAX;
  return ratio;
};

// ────────────────────────────────────────────────────────────────────────────
// Id generation
// ────────────────────────────────────────────────────────────────────────────

let idCounter = 0;
const newStackId = (): StackId => {
  idCounter += 1;
  return `stk-${Date.now().toString(36)}-${idCounter.toString(36)}`;
};
const newSplitId = (): string => {
  idCounter += 1;
  return `spl-${Date.now().toString(36)}-${idCounter.toString(36)}`;
};

// ────────────────────────────────────────────────────────────────────────────
// Node constructors
// ────────────────────────────────────────────────────────────────────────────

export const stack = (paneIds: ReadonlyArray<PaneId>, activePaneId?: PaneId | null, id?: StackId): StackNode => {
  const resolvedActive =
    activePaneId !== undefined
      ? activePaneId
      : paneIds.length > 0
        ? (paneIds[0] as PaneId)
        : null;
  return {
    kind: 'stack',
    id: id ?? newStackId(),
    paneIds,
    activePaneId: paneIds.length === 0 ? null : resolvedActive,
  };
};

export const splitNode = (
  a: LayoutNode,
  b: LayoutNode,
  orientation: SplitOrientation,
  ratio: number = DEFAULT_RATIO,
  id?: string,
): SplitNode => ({
  kind: 'split',
  id: id ?? newSplitId(),
  orientation,
  a,
  b,
  ratio: clampRatio(ratio),
});

export const isStack = (node: LayoutNode): node is StackNode => node.kind === 'stack';
export const isSplit = (node: LayoutNode): node is SplitNode => node.kind === 'split';

// ────────────────────────────────────────────────────────────────────────────
// Edge → split metadata
// ────────────────────────────────────────────────────────────────────────────

export const orientationFromEdge = (edge: Exclude<DropEdge, 'center'>): SplitOrientation => {
  return edge === 'left' || edge === 'right' ? 'row' : 'column';
};

export const branchFromEdge = (edge: Exclude<DropEdge, 'center'>): SplitBranch => {
  return edge === 'left' || edge === 'top' ? 'a' : 'b';
};

// ────────────────────────────────────────────────────────────────────────────
// Traversal helpers
// ────────────────────────────────────────────────────────────────────────────

export const collectStacks = (node: LayoutNode): ReadonlyArray<StackNode> => {
  if (isStack(node)) return [node];
  return [...collectStacks(node.a), ...collectStacks(node.b)];
};

export const collectPaneIds = (node: LayoutNode): ReadonlyArray<PaneId> => {
  if (isStack(node)) return node.paneIds;
  return [...collectPaneIds(node.a), ...collectPaneIds(node.b)];
};

export const findStack = (node: LayoutNode, stackId: StackId): StackNode | null => {
  if (isStack(node)) return node.id === stackId ? node : null;
  return findStack(node.a, stackId) ?? findStack(node.b, stackId);
};

export const findStackContainingPane = (node: LayoutNode, paneId: PaneId): StackNode | null => {
  if (isStack(node)) return node.paneIds.includes(paneId) ? node : null;
  return findStackContainingPane(node.a, paneId) ?? findStackContainingPane(node.b, paneId);
};

export const findStackPath = (node: LayoutNode, stackId: StackId): SplitPath | null => {
  if (isStack(node)) return node.id === stackId ? [] : null;
  const a = findStackPath(node.a, stackId);
  if (a) return ['a', ...a];
  const b = findStackPath(node.b, stackId);
  if (b) return ['b', ...b];
  return null;
};

export const nodeAtPath = (node: LayoutNode, path: SplitPath): LayoutNode => {
  if (path.length === 0) return node;
  if (isStack(node)) {
    throw new Error(`Path ${path.join('/')} descends into a stack leaf`);
  }
  const [head, ...rest] = path;
  return nodeAtPath(head === 'a' ? node.a : node.b, rest);
};

const replaceAtPath = (node: LayoutNode, path: SplitPath, replacement: LayoutNode): LayoutNode => {
  if (path.length === 0) return replacement;
  if (isStack(node)) {
    throw new Error(`Cannot descend into stack while replacing at path ${path.join('/')}`);
  }
  const [head, ...rest] = path;
  if (head === 'a') return { ...node, a: replaceAtPath(node.a, rest, replacement) };
  return { ...node, b: replaceAtPath(node.b, rest, replacement) };
};

export const firstStackId = (node: LayoutNode): StackId | null => {
  if (isStack(node)) return node.id;
  return firstStackId(node.a) ?? firstStackId(node.b);
};

export const firstPaneId = (node: LayoutNode): PaneId | null => {
  if (isStack(node)) return node.paneIds.length > 0 ? (node.paneIds[0] as PaneId) : null;
  return firstPaneId(node.a) ?? firstPaneId(node.b);
};

// ────────────────────────────────────────────────────────────────────────────
// Mutations — all return a new tree
// ────────────────────────────────────────────────────────────────────────────

/**
 * Insert a pane into a stack at `index` (or the end if index is undefined).
 * Returns a cloned stack with the pane appended and made active.
 */
export const insertPaneInStack = (
  node: StackNode,
  paneId: PaneId,
  index?: number,
): StackNode => {
  if (node.paneIds.includes(paneId)) {
    // Moving within a stack — reorder instead of duplicate.
    return reorderPaneInStack(node, paneId, index ?? node.paneIds.length);
  }
  const clampedIndex = index === undefined ? node.paneIds.length : Math.max(0, Math.min(index, node.paneIds.length));
  const nextPaneIds = [
    ...node.paneIds.slice(0, clampedIndex),
    paneId,
    ...node.paneIds.slice(clampedIndex),
  ];
  return { ...node, paneIds: nextPaneIds, activePaneId: paneId };
};

/** Move an existing pane within its stack to a new index. No-op if not present. */
export const reorderPaneInStack = (node: StackNode, paneId: PaneId, toIndex: number): StackNode => {
  const from = node.paneIds.indexOf(paneId);
  if (from === -1) return node;
  const without = node.paneIds.filter((id) => id !== paneId);
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  const nextPaneIds = [...without.slice(0, clamped), paneId, ...without.slice(clamped)];
  return { ...node, paneIds: nextPaneIds };
};

/** Remove a pane from a stack. Returns the updated stack (possibly empty). */
export const removePaneFromStack = (node: StackNode, paneId: PaneId): StackNode => {
  const nextPaneIds = node.paneIds.filter((id) => id !== paneId);
  if (nextPaneIds.length === node.paneIds.length) return node;
  let nextActive: PaneId | null;
  if (nextPaneIds.length === 0) {
    nextActive = null;
  } else if (node.activePaneId === paneId) {
    const removedIndex = node.paneIds.indexOf(paneId);
    const replacement = nextPaneIds[removedIndex] ?? nextPaneIds[removedIndex - 1] ?? nextPaneIds[0] ?? null;
    nextActive = replacement;
  } else {
    nextActive = node.activePaneId;
  }
  return { ...node, paneIds: nextPaneIds, activePaneId: nextActive };
};

/**
 * Remove an empty stack from the tree. If the root stack becomes empty the
 * function returns `null`, which means the caller should close the tab.
 * Otherwise the sibling collapses upward to replace the parent split.
 */
export const collapseEmptyStacks = (node: LayoutNode): LayoutNode | null => {
  if (isStack(node)) return node.paneIds.length === 0 ? null : node;
  const a = collapseEmptyStacks(node.a);
  const b = collapseEmptyStacks(node.b);
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  if (a === node.a && b === node.b) return node;
  return { ...node, a, b };
};

/**
 * Replace a specific stack inside a tree. Returns the new tree. Throws if the
 * stack is not found.
 */
export const replaceStack = (node: LayoutNode, stackId: StackId, replacement: LayoutNode): LayoutNode => {
  const path = findStackPath(node, stackId);
  if (!path) throw new Error(`replaceStack: stack ${stackId} not found`);
  return replaceAtPath(node, path, replacement);
};

/**
 * Split a stack on `edge`, putting a new stack on that side containing
 * `newStack.paneIds`. Returns the new tree.
 */
export const splitStackOnEdge = (
  node: LayoutNode,
  targetStackId: StackId,
  edge: Exclude<DropEdge, 'center'>,
  newStack: StackNode,
  ratio: number = DEFAULT_RATIO,
): LayoutNode => {
  const path = findStackPath(node, targetStackId);
  if (!path) throw new Error(`splitStackOnEdge: stack ${targetStackId} not found`);
  const target = nodeAtPath(node, path);
  const orientation = orientationFromEdge(edge);
  const branch = branchFromEdge(edge);
  const split: SplitNode =
    branch === 'a'
      ? splitNode(newStack, target, orientation, ratio)
      : splitNode(target, newStack, orientation, ratio);
  return replaceAtPath(node, path, split);
};

/** Set the ratio of a specific split by id. No-op if split id not found. */
export const setSplitRatioById = (node: LayoutNode, splitId: string, ratio: number): LayoutNode => {
  if (isStack(node)) return node;
  if (node.id === splitId) return { ...node, ratio: clampRatio(ratio) };
  const a = setSplitRatioById(node.a, splitId, ratio);
  const b = setSplitRatioById(node.b, splitId, ratio);
  if (a === node.a && b === node.b) return node;
  return { ...node, a, b };
};

// ────────────────────────────────────────────────────────────────────────────
// High-level operation — move a pane to a drop target
// ────────────────────────────────────────────────────────────────────────────

export type MovePaneResult = {
  readonly layout: LayoutNode;
  readonly activeStackId: StackId;
};

/**
 * Move `paneId` from its current stack to a drop location against
 * `targetStackId`. Handles all drop kinds:
 *
 *   - center / insert  → moves the pane into the target stack (same-stack
 *     reorders supported).
 *   - edge             → creates a new stack on that side of the target
 *     containing the moved pane.
 *
 * Collapses the source stack when it becomes empty.
 */
export const movePaneToStack = (
  layout: LayoutNode,
  paneId: PaneId,
  targetStackId: StackId,
  target: DropTarget,
): MovePaneResult | null => {
  const source = findStackContainingPane(layout, paneId);
  if (!source) return null;
  const targetStack = findStack(layout, targetStackId);
  if (!targetStack) return null;

  // Same-stack reorder path — simpler + avoids collapse churn.
  if (source.id === targetStack.id) {
    if (target.kind === 'edge') {
      // Splitting off a single pane from a 1-pane stack is a no-op.
      if (source.paneIds.length <= 1) return null;
      const withoutPane: StackNode = removePaneFromStack(source, paneId);
      const newStackNode: StackNode = stack([paneId], paneId);
      const layoutWithoutPane = replaceStack(layout, source.id, withoutPane);
      const nextLayout = splitStackOnEdge(layoutWithoutPane, source.id, target.edge, newStackNode);
      return { layout: nextLayout, activeStackId: newStackNode.id };
    }
    const toIndex = target.kind === 'insert' ? target.index : source.paneIds.length - 1;
    const reordered = reorderPaneInStack(source, paneId, toIndex);
    const withActive: StackNode = { ...reordered, activePaneId: paneId };
    return { layout: replaceStack(layout, source.id, withActive), activeStackId: source.id };
  }

  // Cross-stack move.
  const sourceAfterRemoval = removePaneFromStack(source, paneId);
  const layoutAfterRemoval = replaceStack(layout, source.id, sourceAfterRemoval);
  const collapsed = collapseEmptyStacks(layoutAfterRemoval);
  if (!collapsed) return null; // last pane in whole tab — caller should close tab

  if (target.kind === 'edge') {
    const newStackNode: StackNode = stack([paneId], paneId);
    const nextLayout = splitStackOnEdge(collapsed, targetStack.id, target.edge, newStackNode);
    return { layout: nextLayout, activeStackId: newStackNode.id };
  }

  const insertIndex = target.kind === 'insert' ? target.index : targetStack.paneIds.length;
  const updatedTarget = insertPaneInStack(targetStack, paneId, insertIndex);
  const nextLayout = replaceStack(collapsed, targetStack.id, updatedTarget);
  return { layout: nextLayout, activeStackId: targetStack.id };
};

// ────────────────────────────────────────────────────────────────────────────
// Spatial neighbor lookup (keyboard nav)
// ────────────────────────────────────────────────────────────────────────────

type SpatialRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type SpatialEntry = { readonly stackId: StackId; readonly rect: SpatialRect };

const collectSpatialLayout = (node: LayoutNode, rect: SpatialRect, out: Array<SpatialEntry>): void => {
  if (isStack(node)) {
    out.push({ stackId: node.id, rect });
    return;
  }
  const ratio = clampRatio(node.ratio);
  if (node.orientation === 'row') {
    const widthA = rect.width * ratio;
    collectSpatialLayout(node.a, { ...rect, width: widthA }, out);
    collectSpatialLayout(
      node.b,
      { x: rect.x + widthA, y: rect.y, width: rect.width - widthA, height: rect.height },
      out,
    );
  } else {
    const heightA = rect.height * ratio;
    collectSpatialLayout(node.a, { ...rect, height: heightA }, out);
    collectSpatialLayout(
      node.b,
      { x: rect.x, y: rect.y + heightA, width: rect.width, height: rect.height - heightA },
      out,
    );
  }
};

/** Find the stack spatially adjacent to `originStackId` in `direction`. */
export const getSpatialNeighborStackId = (
  layout: LayoutNode,
  originStackId: StackId,
  direction: FocusDirection,
): StackId | null => {
  const entries: Array<SpatialEntry> = [];
  collectSpatialLayout(layout, { x: 0, y: 0, width: 1, height: 1 }, entries);
  const origin = entries.find((entry) => entry.stackId === originStackId);
  if (!origin) return null;
  const candidates = entries.filter((entry) => entry.stackId !== originStackId);

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
  return first ? first.stackId : null;
};

// ────────────────────────────────────────────────────────────────────────────
// Drop-zone classification (pure — lives here so it's testable + shared)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fraction of the body that counts as "edge" vs. "center" when a drag hovers a
 * stack. 0.28 means the outer 28% on every side is an edge zone and the inner
 * 44% square is the center. Tuned to match the old workspace drop affordance.
 */
export const EDGE_ZONE_FRACTION = 0.28;

export type BodyDrop =
  | { readonly kind: 'edge'; readonly edge: 'top' | 'right' | 'bottom' | 'left' }
  | { readonly kind: 'center' };

/**
 * Classify a pointer position inside a stack body rect into one of five drop
 * zones (four edges + center). Returns `null` when the pointer coords are
 * non-finite.
 */
export const classifyBodyDrop = (
  rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  clientX: number,
  clientY: number,
): BodyDrop | null => {
  const ratioX = (clientX - rect.left) / rect.width;
  const ratioY = (clientY - rect.top) / rect.height;
  if (Number.isNaN(ratioX) || Number.isNaN(ratioY)) return null;

  const insideCenter =
    ratioX > EDGE_ZONE_FRACTION &&
    ratioX < 1 - EDGE_ZONE_FRACTION &&
    ratioY > EDGE_ZONE_FRACTION &&
    ratioY < 1 - EDGE_ZONE_FRACTION;
  if (insideCenter) return { kind: 'center' };

  const distLeft = ratioX;
  const distRight = 1 - ratioX;
  const distTop = ratioY;
  const distBottom = 1 - ratioY;
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min === distLeft) return { kind: 'edge', edge: 'left' };
  if (min === distRight) return { kind: 'edge', edge: 'right' };
  if (min === distTop) return { kind: 'edge', edge: 'top' };
  return { kind: 'edge', edge: 'bottom' };
};
