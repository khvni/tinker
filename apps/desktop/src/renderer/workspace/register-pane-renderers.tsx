import type { JSX } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { MemoryPane } from '../panes/MemoryPane/index.js';
import { PlaybookPane } from './components/PlaybookPane/index.js';
import { SettingsPane } from './components/SettingsPane/index.js';
import { getRenderer, registerPane } from './pane-registry.js';

type RegisterablePaneKind = 'settings' | 'memory' | 'playbook';

const renderSettingsPane = (
  _data: Extract<TinkerPaneData, { readonly kind: 'settings' }>,
): JSX.Element => {
  return <SettingsPane />;
};

const renderMemoryPane = (
  _data: Extract<TinkerPaneData, { readonly kind: 'memory' }>,
): JSX.Element => {
  return <MemoryPane />;
};

const renderPlaybookPane = (
  _data: Extract<TinkerPaneData, { readonly kind: 'playbook' }>,
): JSX.Element => {
  return <PlaybookPane />;
};

const isMissingPaneError = (kind: RegisterablePaneKind, error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.startsWith(`getRenderer: no renderer registered for pane kind "${kind}".`)
  );
};

const ensurePaneRegistered = (kind: RegisterablePaneKind, register: () => void): void => {
  try {
    getRenderer(kind);
    return;
  } catch (error) {
    if (!isMissingPaneError(kind, error)) {
      throw error;
    }
  }

  register();
};

// Future settings, memory, and playbook tasks should replace the component
// internals, not the registry wiring. M1.3/M1.4/TIN-114 extend this same boot
// entrypoint.
export const registerWorkspacePaneRenderers = (): void => {
  ensurePaneRegistered('settings', () => {
    registerPane('settings', renderSettingsPane);
  });

  ensurePaneRegistered('memory', () => {
    registerPane('memory', renderMemoryPane);
  });

  ensurePaneRegistered('playbook', () => {
    registerPane('playbook', renderPlaybookPane);
  });
};
