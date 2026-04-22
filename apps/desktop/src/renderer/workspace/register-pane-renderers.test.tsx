import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SSOStatus } from '@tinker/shared-types';
import { FilePaneRuntimeContext } from '../panes/FilePane/file-pane-runtime.js';
import { getRenderer, resetPaneRegistry } from './pane-registry.js';
import { MemoryPaneRuntimeContext } from './memory-pane-runtime.js';
import { registerWorkspacePaneRenderers } from './register-pane-renderers.js';
import {
  SettingsPaneRuntimeContext,
  type SettingsPaneRuntime,
} from './settings-pane-runtime.js';

const emptySessions: SSOStatus = { google: null, github: null, microsoft: null };

const settingsRuntime: SettingsPaneRuntime = {
  sessions: emptySessions,
  activeSession: null,
  signOutBusy: false,
  signOutMessage: null,
  onSignOut: vi.fn(),
  opencode: null,
  vaultPath: null,
  mcpSeedStatuses: {},
  onRequestRespawn: vi.fn().mockResolvedValue(undefined),
};

describe('registerWorkspacePaneRenderers', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('registers settings placeholder and memory pane renderers', () => {
    registerWorkspacePaneRenderers();
    expect(() => registerWorkspacePaneRenderers()).not.toThrow();

    const settingsMarkup = renderToStaticMarkup(
      <SettingsPaneRuntimeContext.Provider value={settingsRuntime}>
        <>{getRenderer('settings')({ kind: 'settings' })}</>
      </SettingsPaneRuntimeContext.Provider>,
    );
    const memoryMarkup = renderToStaticMarkup(
      <MemoryPaneRuntimeContext.Provider value={{ currentUserId: 'local-user' }}>
        <FilePaneRuntimeContext.Provider value={{ vaultRevision: 0, openFile: () => undefined }}>
          <>{getRenderer('memory')({ kind: 'memory' })}</>
        </FilePaneRuntimeContext.Provider>
      </MemoryPaneRuntimeContext.Provider>,
    );

    expect(settingsMarkup).toContain('Account');
    expect(settingsMarkup).toContain('Not signed in');
    expect(memoryMarkup).toContain('Memory files');
    expect(memoryMarkup).toContain('tinker-memory-pane');
    expect(memoryMarkup).toContain('Loading…');
  });
});
