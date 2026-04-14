import type { MemoryStore } from '@tinker/shared-types';
import type { DockviewApi } from 'dockview-react';

type DefaultLayoutOptions = {
  memoryStore: MemoryStore;
  vaultPath: string | null;
};

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

  const chatPanel = {
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
  };

  api.addPanel(chatPanel);

  api.addPanel({
    id: 'today',
    component: 'today',
    title: 'Today',
    position: {
      referencePanel: 'chat',
      direction: 'right',
    },
  });

  api.addPanel({
    id: 'settings',
    component: 'settings',
    title: 'Settings',
    inactive: true,
    position: {
      referencePanel: 'today',
      direction: 'within',
    },
  });
};
