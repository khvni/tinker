export type PaneKind =
  | 'vault-browser'
  | 'chat'
  | 'today'
  | 'settings'
  | 'markdown-editor'
  | 'file'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'image'
  | 'code';

export type LayoutState = {
  version: 1;
  dockviewModel: unknown;
  updatedAt: string;
};

export type LayoutStore = {
  load(userId: string): Promise<LayoutState | null>;
  save(userId: string, state: LayoutState): Promise<void>;
};
