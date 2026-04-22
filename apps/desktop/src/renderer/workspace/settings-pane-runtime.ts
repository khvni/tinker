import { createContext, useContext } from 'react';
import type { SSOSession, SSOStatus } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../bindings.js';
import type { BuiltinMcpName, MCPStatus } from '../integrations.js';

export type SettingsPaneRuntime = {
  readonly sessions: SSOStatus;
  readonly activeSession: SSOSession | null;
  readonly signOutBusy: boolean;
  readonly signOutMessage: string | null;
  readonly opencode: OpencodeConnection | null;
  readonly vaultPath: string | null;
  readonly mcpSeedStatuses: Partial<Record<BuiltinMcpName, MCPStatus>>;
  onSignOut(session: SSOSession): Promise<void>;
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
