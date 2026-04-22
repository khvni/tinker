import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRenderer, resetPaneRegistry } from './pane-registry.js';
import { registerWorkspacePaneRenderers } from './register-pane-renderers.js';

describe('registerWorkspacePaneRenderers', () => {
  afterEach(() => {
    resetPaneRegistry();
  });

  it('registers friendly settings and memory placeholder panes', () => {
    registerWorkspacePaneRenderers();
    expect(() => registerWorkspacePaneRenderers()).not.toThrow();

    const settingsMarkup = renderToStaticMarkup(
      <>{getRenderer('settings')({ kind: 'settings' })}</>,
    );
    const memoryMarkup = renderToStaticMarkup(<>{getRenderer('memory')({ kind: 'memory' })}</>);

    expect(settingsMarkup).toContain('Settings panel coming soon');
    expect(settingsMarkup).toContain('workspace controls');
    expect(memoryMarkup).toContain('Memory view coming soon');
    expect(memoryMarkup).toContain('cross-session recall');
  });
});
