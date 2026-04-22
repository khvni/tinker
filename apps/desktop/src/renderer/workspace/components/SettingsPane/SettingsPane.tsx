import { useMemo, type JSX } from 'react';
import { AccountPanel } from '../AccountPanel/index.js';
import { EmptyPane } from '../EmptyPane/index.js';
import { SettingsShell, type SettingsShellSection } from '../SettingsShell/index.js';
import { useSettingsPaneRuntime } from '../../settings-pane-runtime.js';

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
    ],
    [runtime.activeSession, runtime.signOutBusy, runtime.signOutMessage, runtime.onSignOut],
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
