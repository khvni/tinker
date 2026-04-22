import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SSOStatus } from '@tinker/shared-types';
import { getRenderer, resetPaneRegistry } from './pane-registry.js';
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
};

describe('registerWorkspacePaneRenderers', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('registers friendly settings and memory placeholder panes', () => {
    registerWorkspacePaneRenderers();
    expect(() => registerWorkspacePaneRenderers()).not.toThrow();

    const settingsMarkup = renderToStaticMarkup(
      <SettingsPaneRuntimeContext.Provider value={settingsRuntime}>
        <>{getRenderer('settings')({ kind: 'settings' })}</>
      </SettingsPaneRuntimeContext.Provider>,
    );
    const memoryMarkup = renderToStaticMarkup(<>{getRenderer('memory')({ kind: 'memory' })}</>);

    expect(settingsMarkup).toContain('Account');
    expect(settingsMarkup).toContain('Not signed in');
    expect(memoryMarkup).toContain('Memory view coming soon');
    expect(memoryMarkup).toContain('cross-session recall');
  });
});
