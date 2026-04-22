import { createContext, useContext, type JSX, type ReactNode } from 'react';
import type { SSOStatus } from '@tinker/shared-types';
import type { MCPStatus } from '../../integrations.js';
import { EmptyPane } from '../../workspace/components/EmptyPane/index.js';
import { Settings } from './Settings.js';
import type { AccountUser } from './sections/Account/index.js';

export type SettingsConnectionValue = {
  readonly modelConnected: boolean;
  readonly modelAuthBusy: boolean;
  readonly modelAuthMessage: string | null;
  readonly googleAuthBusy: boolean;
  readonly googleAuthMessage: string | null;
  readonly githubAuthBusy: boolean;
  readonly githubAuthMessage: string | null;
  readonly microsoftAuthBusy: boolean;
  readonly microsoftAuthMessage: string | null;
  readonly sessions: SSOStatus;
  readonly mcpStatus: Record<string, MCPStatus>;
  readonly vaultPath: string | null;
  readonly currentUser: AccountUser | null;
  readonly signOutBusy: boolean;
  readonly signOutMessage: string | null;
  readonly onConnectModel: () => Promise<void>;
  readonly onConnectGoogle: () => Promise<void>;
  readonly onConnectGithub: () => Promise<void>;
  readonly onConnectMicrosoft: () => Promise<void>;
  readonly onDisconnectModel: () => Promise<void>;
  readonly onDisconnectGoogle: () => Promise<void>;
  readonly onDisconnectGithub: () => Promise<void>;
  readonly onDisconnectMicrosoft: () => Promise<void>;
  readonly onCreateVault: () => Promise<void>;
  readonly onSelectVault: () => Promise<void>;
  readonly onSignOut: () => Promise<void> | void;
};

const SettingsConnectionContext = createContext<SettingsConnectionValue | null>(null);

export const SettingsConnectionProvider = ({
  value,
  children,
}: {
  readonly value: SettingsConnectionValue;
  readonly children: ReactNode;
}): JSX.Element => (
  <SettingsConnectionContext.Provider value={value}>{children}</SettingsConnectionContext.Provider>
);

export const useSettingsConnection = (): SettingsConnectionValue | null => {
  return useContext(SettingsConnectionContext);
};

export const ConnectedSettings = (): JSX.Element => {
  const value = useSettingsConnection();

  if (!value) {
    return (
      <EmptyPane
        eyebrow="Settings"
        title="Settings unavailable"
        description="The settings pane needs to be rendered inside a Tinker workspace session."
      />
    );
  }

  return <Settings {...value} />;
};
