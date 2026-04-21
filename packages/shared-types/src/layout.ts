export type TabKind =
  | 'vault-browser'
  | 'chat'
  | 'today'
  | 'scheduler'
  | 'settings'
  | 'playbook'
  | 'markdown-editor'
  | 'file'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'image'
  | 'code';

export type WorkspacePreferences = {
  autoOpenAgentWrittenFiles: boolean;
};

export const createDefaultWorkspacePreferences = (): WorkspacePreferences => {
  return {
    autoOpenAgentWrittenFiles: true,
  };
};

export type LayoutState = {
  version: 1;
  dockviewModel: unknown;
  updatedAt: string;
  preferences: WorkspacePreferences;
};

export type LayoutStore = {
  load(userId: string): Promise<LayoutState | null>;
  save(userId: string, state: LayoutState): Promise<void>;
};
