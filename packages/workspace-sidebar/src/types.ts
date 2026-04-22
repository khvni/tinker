export type SidebarStatusFormat = 'plain' | 'markdown';

export type SidebarFlashAccent = 'notification-blue' | 'navigation-teal';

export type SidebarStatusEntry = {
  readonly key: string;
  readonly value: string;
  readonly priority: number;
  readonly format: SidebarStatusFormat;
  readonly timestamp: number;
  readonly icon?: string;
  readonly color?: string;
  readonly url?: string;
};

export type WorkspaceCardAttention = {
  readonly unread: boolean;
  readonly flash: SidebarFlashAccent | null;
};

export type WorkspaceCardModel = {
  readonly id: string;
  readonly title: string;
  readonly pinned: boolean;
  readonly entries: ReadonlyArray<SidebarStatusEntry>;
  readonly attention: WorkspaceCardAttention;
};
