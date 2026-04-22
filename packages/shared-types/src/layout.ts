import type { WorkspaceState } from '@tinker/panes';
import type { TinkerPaneData } from './pane.js';

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

export type PersistedWorkspaceState = WorkspaceState<TinkerPaneData>;

export type LayoutState = {
  version: 2;
  workspaceState: PersistedWorkspaceState;
  updatedAt: string;
  preferences: WorkspacePreferences;
};

export type LayoutStore = {
  load(userId: string): Promise<LayoutState | null>;
  save(userId: string, state: LayoutState): Promise<void>;
};
