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

export type CustomMcpEntry = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly headerName: string;
  readonly enabled: boolean;
};

export type WorkspacePreferences = {
  autoOpenAgentWrittenFiles: boolean;
  isLeftRailVisible: boolean;
  isRightInspectorVisible: boolean;
  customMcps: ReadonlyArray<CustomMcpEntry>;
};

export const createDefaultWorkspacePreferences = (): WorkspacePreferences => {
  return {
    autoOpenAgentWrittenFiles: true,
    isLeftRailVisible: true,
    isRightInspectorVisible: false,
    customMcps: [],
  };
};

export type LayoutState = {
  version: 3;
  layoutJson: unknown;
  updatedAt: string;
  preferences: WorkspacePreferences;
};

export type LayoutStore = {
  load(userId: string): Promise<LayoutState | null>;
  save(userId: string, state: LayoutState): Promise<void>;
};
