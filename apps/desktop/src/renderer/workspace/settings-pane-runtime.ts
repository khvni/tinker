import { createContext, useContext } from 'react';
import type { SSOSession, SSOStatus, User, WorkspacePreferences } from '@tinker/shared-types';
import type { AuthProvider, OpencodeConnection } from '../../bindings.js';
import type { BuiltinMcpName, MCPStatus } from '../integrations.js';

export type ProviderBusyState = Record<AuthProvider, boolean>;
export type ProviderMessageState = Partial<Record<AuthProvider, string | null>>;

export type SettingsPaneRuntime = {
  readonly nativeRuntimeAvailable: boolean;
  readonly currentUserName: string;
  readonly currentUserProvider: User['provider'];
  readonly currentUserEmail: string | null;
  readonly currentUserAvatarUrl: string | null;
  readonly sessions: SSOStatus;
  readonly activeSession: SSOSession | null;
  readonly signOutBusy: boolean;
  readonly signOutMessage: string | null;
  readonly guestBusy: boolean;
  readonly guestMessage: string | null;
  readonly providerBusy: ProviderBusyState;
  readonly providerMessages: ProviderMessageState;
  readonly modelConnected: boolean;
  readonly modelAuthBusy: boolean;
  readonly modelAuthMessage: string | null;
  readonly workspacePreferences: WorkspacePreferences;
  readonly opencode: OpencodeConnection | null;
  readonly vaultPath: string | null;
  readonly mcpSeedStatuses: Partial<Record<BuiltinMcpName, MCPStatus>>;
  // One-shot navigation hint. When set, SettingsPane seeds SettingsShell with this
  // section id on its next render, then calls `onPendingSectionConsumed` so the hint
  // is cleared and subsequent local-state nav wins. Avoids controlled-mode plumbing
  // just for "open Settings and jump to Connections".
  readonly pendingSectionId: string | null;
  onPendingSectionConsumed(): void;
  onWorkspacePreferencesChange(nextPreferences: WorkspacePreferences): void;
  onSignOut(session: SSOSession): Promise<void>;
  onContinueAsGuest(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onConnectGithub(): Promise<void>;
  onConnectMicrosoft(): Promise<void>;
  onConnectModel(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onRequestRespawn(): Promise<void>;
};

export const SettingsPaneRuntimeContext = createContext<SettingsPaneRuntime | null>(null);

export const useSettingsPaneRuntime = (): SettingsPaneRuntime => {
  const runtime = useContext(SettingsPaneRuntimeContext);
  if (!runtime) {
    throw new Error(
      'Settings pane runtime is missing. Wrap workspace panes in SettingsPaneRuntimeContext.Provider.',
    );
  }

  return runtime;
};

// Identity model permits one active user at a time (feature 28-mvp-identity); ordering
// resolves the rare case where multiple providers are connected — prefer Google, then
// GitHub, then Microsoft, mirroring the same precedence used by App's `pickCurrentUserId`.
export const pickActiveSession = (sessions: SSOStatus): SSOSession | null => {
  return sessions.google ?? sessions.github ?? sessions.microsoft ?? null;
};
