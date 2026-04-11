export type PaneKind =
  | 'chat'
  | 'dojo'
  | 'today'
  | 'scheduled'
  | 'settings'
  | 'file'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'image'
  | 'code';

export type PaneDescriptor = {
  id: string;
  kind: PaneKind;
  title: string;
  props?: Record<string, unknown>;
};

export type LayoutState = {
  version: 1;
  model: unknown;
  panes: PaneDescriptor[];
  updatedAt: string;
};

export type LayoutStore = {
  load(userId: string): Promise<LayoutState | null>;
  save(userId: string, state: LayoutState): Promise<void>;
};
