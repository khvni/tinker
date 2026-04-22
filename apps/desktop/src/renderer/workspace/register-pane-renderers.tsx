import type { JSX } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { MemoryPane } from './components/MemoryPane/index.js';
import { SettingsPane } from './components/SettingsPane/index.js';
import { registerPane } from './pane-registry.js';

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

// Future settings and memory tasks should replace the component internals,
// not the registry wiring. M1.3/M1.4 extend this same boot entrypoint.
export const registerWorkspacePaneRenderers = (): void => {
  registerPane('settings', renderSettingsPane);
  registerPane('memory', renderMemoryPane);
};
