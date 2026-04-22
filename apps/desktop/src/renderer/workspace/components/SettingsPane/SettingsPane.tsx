import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { MemorySettingsPanel } from '../MemorySettingsPanel/index.js';
import { SettingsShell, type SettingsShellSection } from '../SettingsShell/index.js';
import { useSettingsPaneRuntime } from '../../settings-pane-runtime.js';
import { ConnectionsSection } from '../../../panes/Settings/ConnectionsSection/index.js';
import { AccountSection } from './components/AccountSection/index.js';
import { ModelSection } from './components/ModelSection/index.js';

export const SettingsPane = (): JSX.Element => {
  const runtime = useSettingsPaneRuntime();
  const [activeSectionId, setActiveSectionId] = useState<string>('account');
  const consumedRef = useRef<string | null>(null);

  // When the rail nav (e.g. Connections item) opens this pane with a target section,
  // the runtime carries a one-shot `pendingSectionId`. Consume it exactly once then
  // let local state drive subsequent nav so the user can still click around freely.
  useEffect(() => {
    const pending = runtime.pendingSectionId;
    if (pending && pending !== consumedRef.current) {
      consumedRef.current = pending;
      setActiveSectionId(pending);
      runtime.onPendingSectionConsumed();
    }
  }, [runtime]);

  const sections = useMemo<ReadonlyArray<SettingsShellSection>>(
    () => [
      {
        id: 'account',
        label: 'Account',
        content: (
          <AccountSection
            currentUserName={runtime.currentUserName}
            currentUserProvider={runtime.currentUserProvider}
            currentUserEmail={runtime.currentUserEmail}
            currentUserAvatarUrl={runtime.currentUserAvatarUrl}
            nativeRuntimeAvailable={runtime.nativeRuntimeAvailable}
            guestBusy={runtime.guestBusy}
            guestMessage={runtime.guestMessage}
            providerBusy={runtime.providerBusy}
            providerMessages={runtime.providerMessages}
            sessions={runtime.sessions}
            onContinueAsGuest={runtime.onContinueAsGuest}
            onConnectGoogle={runtime.onConnectGoogle}
            onConnectGithub={runtime.onConnectGithub}
            onConnectMicrosoft={runtime.onConnectMicrosoft}
          />
        ),
      },
      {
        id: 'model',
        label: 'Model',
        content: (
          <ModelSection
            nativeRuntimeAvailable={runtime.nativeRuntimeAvailable}
            modelConnected={runtime.modelConnected}
            modelAuthBusy={runtime.modelAuthBusy}
            modelAuthMessage={runtime.modelAuthMessage}
            onConnectModel={runtime.onConnectModel}
            onDisconnectModel={runtime.onDisconnectModel}
          />
        ),
      },
      {
        id: 'memory',
        label: 'Memory',
        content: (
          <MemorySettingsPanel
            workspacePreferences={runtime.workspacePreferences}
            onWorkspacePreferencesChange={runtime.onWorkspacePreferencesChange}
          />
        ),
      },
      {
        id: 'connections',
        label: 'Connections',
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
    [runtime],
  );

  return (
    <SettingsShell
      title="Settings"
      sections={sections}
      activeSectionId={activeSectionId}
      scrollTargetSectionId={runtime.pendingSectionId ?? undefined}
      onActiveSectionChange={setActiveSectionId}
    />
  );
};
