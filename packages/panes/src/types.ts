// Domain types for @tinker/panes.
//
// A Tab owns one recursive LayoutNode tree. Each leaf of the tree references a
// Pane by id. A WorkspaceState is a collection of Tabs with one active Tab.

export type SplitOrientation = 'row' | 'column';

export type SplitBranch = 'a' | 'b';

export type SplitPath = ReadonlyArray<SplitBranch>;

export type DropEdge = 'top' | 'right' | 'bottom' | 'left';

export type LayoutNode =
  | { readonly kind: 'leaf'; readonly paneId: string }
  | {
      readonly kind: 'split';
      readonly orientation: SplitOrientation;
      readonly a: LayoutNode;
      readonly b: LayoutNode;
      /** Ratio of the `a` side, bounded 0.1..0.9. Defaults to 0.5 when omitted. */
      readonly ratio?: number;
    };

export type Pane<TData> = {
  readonly id: string;
  readonly kind: string;
  readonly title?: string;
  readonly pinned?: boolean;
  readonly data: TData;
};

export type Tab<TData> = {
  readonly id: string;
  readonly title?: string;
  readonly createdAt: number;
  readonly activePaneId: string | null;
  readonly layout: LayoutNode;
  readonly panes: Readonly<Record<string, Pane<TData>>>;
};

export type WorkspaceState<TData> = {
  readonly version: 1;
  readonly tabs: ReadonlyArray<Tab<TData>>;
  readonly activeTabId: string | null;
};

export type FocusDirection = 'up' | 'down' | 'left' | 'right';
