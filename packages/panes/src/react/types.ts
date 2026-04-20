import type { ComponentType, ReactNode } from 'react';
import type { DropEdge, Pane, Tab } from '../types.js';
import type { WorkspaceStore } from '../core/store/store.js';

export type PaneRendererProps<TData> = {
  readonly tabId: string;
  readonly pane: Pane<TData>;
  readonly isActive: boolean;
};

export type PaneRenderer<TData> = ComponentType<PaneRendererProps<TData>>;

export type PaneDefinition<TData> = {
  /** The value of `pane.kind` this renderer applies to. */
  readonly kind: string;
  /** React component rendered inside the pane content area. */
  readonly render: PaneRenderer<TData>;
  /** Optional human label used when no `pane.title` override is set. */
  readonly defaultTitle?: string | ((pane: Pane<TData>) => string);
};

export type PaneRegistry<TData> = Readonly<Record<string, PaneDefinition<TData>>>;

export type TabStripAction = {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export type WorkspaceProps<TData> = {
  readonly store: WorkspaceStore<TData>;
  readonly registry: PaneRegistry<TData>;
  /** Rendered on the right side of the tab strip. Good spot for "+" or menu. */
  readonly tabStripActions?: ReadonlyArray<TabStripAction>;
  /** Callback when the user drops a pane on an edge of another pane. */
  readonly onDropPaneOnPane?: (info: {
    readonly tabId: string;
    readonly sourcePaneId: string;
    readonly targetPaneId: string;
    readonly edge: DropEdge;
  }) => void;
  /** Rendered when no tabs exist. */
  readonly emptyState?: ReactNode;
  /** Accessible label for the overall workspace region. */
  readonly ariaLabel?: string;
};

export type ResolvedTabTitle<TData> = {
  readonly tab: Tab<TData>;
  readonly title: string;
};
