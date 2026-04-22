import { useMemo, type JSX } from 'react';
import { AccountPanel } from '../AccountPanel/index.js';
import { EmptyPane } from '../EmptyPane/index.js';
import { SettingsShell, type SettingsShellSection } from '../SettingsShell/index.js';
import { useSettingsPaneRuntime } from '../../settings-pane-runtime.js';
import { ConnectionsSection } from '../../../panes/Settings/ConnectionsSection/index.js';

const UserIcon = (): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PlugIcon = (): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 2v4" />
    <path d="M15 2v4" />
    <path d="M5 10h14v4a7 7 0 0 1-14 0z" />
    <path d="M12 21v-3" />
  </svg>
);

export const SettingsPane = (): JSX.Element => {
  const runtime = useSettingsPaneRuntime();

  const sections = useMemo<ReadonlyArray<SettingsShellSection>>(
    () => [
      {
        id: 'account',
        label: 'Account',
        icon: <UserIcon />,
        content: (
          <AccountPanel
            session={runtime.activeSession}
            signOutBusy={runtime.signOutBusy}
            signOutMessage={runtime.signOutMessage}
            onSignOut={runtime.onSignOut}
          />
        ),
      },
      {
        id: 'connections',
        label: 'Connections',
        icon: <PlugIcon />,
        content: (
          <ConnectionsSection
            opencode={runtime.opencode}
            vaultPath={runtime.vaultPath}
            memoryPath={runtime.vaultPath}
            seedStatuses={runtime.mcpSeedStatuses}
            onRequestRespawn={runtime.onRequestRespawn}
          />
        ),
      },
    ],
    [
      runtime.activeSession,
      runtime.signOutBusy,
      runtime.signOutMessage,
      runtime.onSignOut,
      runtime.opencode,
      runtime.vaultPath,
      runtime.mcpSeedStatuses,
      runtime.onRequestRespawn,
    ],
  );

  const emptyState = (
    <EmptyPane
      eyebrow="Settings"
      title="Settings panel coming soon"
      description="More sections land here as features ship."
    />
  );

  return <SettingsShell sections={sections} emptyState={emptyState} />;
};
