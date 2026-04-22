import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilePaneRuntimeContext } from '../panes/FilePane/file-pane-runtime.js';
import { getRenderer, resetPaneRegistry } from './pane-registry.js';
import { MemoryPaneRuntimeContext } from './memory-pane-runtime.js';
import { registerWorkspacePaneRenderers } from './register-pane-renderers.js';

describe('registerWorkspacePaneRenderers', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('registers settings placeholder and memory pane renderers', () => {
    registerWorkspacePaneRenderers();
    expect(() => registerWorkspacePaneRenderers()).not.toThrow();

    const settingsMarkup = renderToStaticMarkup(
      <>{getRenderer('settings')({ kind: 'settings' })}</>,
    );
    const memoryMarkup = renderToStaticMarkup(
      <MemoryPaneRuntimeContext.Provider value={{ currentUserId: 'local-user' }}>
        <FilePaneRuntimeContext.Provider value={{ vaultRevision: 0, openFile: () => undefined }}>
          <>{getRenderer('memory')({ kind: 'memory' })}</>
        </FilePaneRuntimeContext.Provider>
      </MemoryPaneRuntimeContext.Provider>,
    );

    expect(settingsMarkup).toContain('Settings panel coming soon');
    expect(settingsMarkup).toContain('workspace controls');
    expect(memoryMarkup).toContain('Memory files');
    expect(memoryMarkup).toContain('Current user');
    expect(memoryMarkup).toContain('Loading…');
  });
});
