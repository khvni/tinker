import type { JSX } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { MemoryPane } from './components/MemoryPane/index.js';
import { SettingsPane } from './components/SettingsPane/index.js';
import { getRenderer, registerPane } from './pane-registry.js';

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

const isMissingPaneError = (kind: 'settings' | 'memory', error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.startsWith(`getRenderer: no renderer registered for pane kind "${kind}".`)
  );
};

const ensurePaneRegistered = (kind: 'settings' | 'memory', register: () => void): void => {
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

// Future settings and memory tasks should replace the component internals,
// not the registry wiring. M1.3/M1.4 extend this same boot entrypoint.
export const registerWorkspacePaneRenderers = (): void => {
  ensurePaneRegistered('settings', () => {
    registerPane('settings', renderSettingsPane);
  });

  ensurePaneRegistered('memory', () => {
    registerPane('memory', renderMemoryPane);
  });
};
