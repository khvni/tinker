// Domain types for @tinker/panes.
//
// A workspace holds N top-level Tabs. Each Tab owns a recursive LayoutNode
// tree. Branches are `Split` (orientation + ratio + two children). Leaves are
// `Stack` — tab groups that hold 1..N Panes with one active. This mirrors the
// grid model used by VSCode, FlexLayout, and rc-dock while staying generic
// over pane payload data.

export type SplitOrientation = 'row' | 'column';

export type SplitBranch = 'a' | 'b';

export type SplitPath = ReadonlyArray<SplitBranch>;

/**
 * Positions a drop can land relative to a Stack.
 *
 *   top / right / bottom / left — split the target stack on that edge and put
 *     the dragged pane in a fresh stack on that side.
 *   center — merge the dragged pane into the target stack as a new tab at the
 *     end of the tab strip.
 */
export type DropEdge = 'top' | 'right' | 'bottom' | 'left' | 'center';

export type StackId = string;
export type PaneId = string;
export type TabId = string;

/**
 * Leaf of the layout tree. A Stack holds an ordered list of panes shown as a
 * tab strip; exactly one pane is active at a time when the stack is non-empty.
 * Stacks keep a stable id across splits/moves so React can preserve mounted
 * subtrees.
 */
export type StackNode = {
  readonly kind: 'stack';
  readonly id: StackId;
  readonly paneIds: ReadonlyArray<PaneId>;
  readonly activePaneId: PaneId | null;
};

/**
 * Branch of the layout tree. `ratio` is the fraction of the parent rect
 * allocated to child `a`, clamped to 0.1..0.9.
 */
export type SplitNode = {
  readonly kind: 'split';
  readonly id: string;
  readonly orientation: SplitOrientation;
  readonly a: LayoutNode;
  readonly b: LayoutNode;
  readonly ratio: number;
};

export type LayoutNode = StackNode | SplitNode;

export type Pane<TData> = {
  readonly id: PaneId;
  readonly kind: string;
  readonly title?: string;
  readonly pinned?: boolean;
  readonly data: TData;
};

export type Tab<TData> = {
  readonly id: TabId;
  readonly title?: string;
  readonly createdAt: number;
  readonly layout: LayoutNode;
  readonly panes: Readonly<Record<PaneId, Pane<TData>>>;
  readonly activePaneId: PaneId | null;
  readonly activeStackId: StackId | null;
};

export type WorkspaceState<TData> = {
  readonly version: 2;
  readonly tabs: ReadonlyArray<Tab<TData>>;
  readonly activeTabId: TabId | null;
};

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Where a moved pane should land inside / next to a target stack.
 *
 * - `{ kind: 'center' }`           — append as the last tab in the target stack.
 * - `{ kind: 'insert', index }`    — insert at tab-strip position `index`.
 * - `{ kind: 'edge', edge }`       — split the target stack on that edge.
 */
export type DropTarget =
  | { readonly kind: 'center' }
  | { readonly kind: 'insert'; readonly index: number }
  | { readonly kind: 'edge'; readonly edge: Exclude<DropEdge, 'center'> };
