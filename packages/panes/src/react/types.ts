import type { AttentionStore } from '@tinker/attention';
import type { ComponentType, ReactNode } from 'react';
import type { DropTarget, Pane, StackId, Tab } from '../types.js';
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
  /** Optional icon shown next to the tab title. */
  readonly icon?: ReactNode | ((pane: Pane<TData>) => ReactNode);
  /** Render a custom body when this pane is the sole one in its stack and no frame is desired. */
  readonly chromeless?: boolean;
};

export type PaneRegistry<TData> = Readonly<Record<string, PaneDefinition<TData>>>;

export type TabStripAction = {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export type WorkspaceAttentionConfig = {
  readonly store: AttentionStore;
  readonly workspaceId: string;
};

export type DropPaneEvent = {
  readonly tabId: string;
  readonly sourcePaneId: string;
  readonly targetStackId: StackId;
  readonly target: DropTarget;
};

export type WorkspaceProps<TData> = {
  readonly store: WorkspaceStore<TData>;
  readonly registry: PaneRegistry<TData>;
  readonly attention?: WorkspaceAttentionConfig;
  /** Rendered on the right side of the workspace tab strip. Good spot for "+" or menu. */
  readonly tabStripActions?: ReadonlyArray<TabStripAction>;
  /** Intercept a pane drop. If supplied, the consumer drives movement themselves. */
  readonly onDropPane?: (event: DropPaneEvent) => void;
  /** Rendered when no tabs exist. */
  readonly emptyState?: ReactNode;
  /** Accessible label for the overall workspace region. */
  readonly ariaLabel?: string;
};

export type ResolvedTabTitle<TData> = {
  readonly tab: Tab<TData>;
  readonly title: string;
};
