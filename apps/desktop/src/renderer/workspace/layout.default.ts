import type { MemoryStore, SkillStore } from '@tinker/shared-types';
import type { DockviewApi } from 'dockview-react';

type DefaultLayoutOptions = {
  memoryStore: MemoryStore;
  skillStore: SkillStore;
  vaultPath: string | null;
};

// Clean default boot: Chat is always present. If a vault is connected we also
// surface the vault browser on the left. Scheduler, Settings, Playbook, and Today
// are reachable on-demand via the workspace header — they would only clutter
// the first-boot view.
export const applyDefaultLayout = (api: DockviewApi, options: DefaultLayoutOptions): void => {
  if (options.vaultPath) {
    api.addPanel({
      id: 'vault-browser',
      component: 'vault-browser',
      title: 'Vault',
      params: {
        memoryStore: options.memoryStore,
        vaultPath: options.vaultPath,
      },
      initialWidth: 280,
      position: {
        direction: 'left',
      },
    });
  }

  api.addPanel({
    id: 'chat',
    component: 'chat',
    title: 'Chat',
    ...(options.vaultPath
      ? {
          position: {
            referencePanel: 'vault-browser',
            direction: 'right' as const,
          },
        }
      : {}),
  });
};
