import { describe, expect, it, vi } from 'vitest';
import { getTabKindForPath, getPanelIdForPath } from '../renderers/file-utils.js';
import { openWorkspaceFile } from './file-open.js';

const createPanelApi = () => {
  return {
    updateParameters: vi.fn(),
    setActive: vi.fn(),
  };
};

describe('openWorkspaceFile', () => {
  it('reuses an existing panel for the same path', () => {
    const panelApi = createPanelApi();
    const api = {
      activePanel: { id: 'something-else' },
      panels: [{ id: getPanelIdForPath(getTabKindForPath('/vault/note.ts'), '/vault/note.ts'), api: panelApi }],
      addPanel: vi.fn(),
    };

    openWorkspaceFile(api, '/vault/note.ts');

    expect(panelApi.updateParameters).toHaveBeenCalledOnce();
    expect(panelApi.updateParameters).toHaveBeenCalledWith({ path: '/vault/note.ts' });
    expect(panelApi.setActive).toHaveBeenCalledOnce();
    expect(api.addPanel).not.toHaveBeenCalled();
  });

  it('creates a new panel next to the active panel when no matching panel exists', () => {
    const api = {
      activePanel: { id: 'chat' },
      panels: [],
      addPanel: vi.fn(),
    };

    openWorkspaceFile(api, '/vault/note.ts');

    expect(api.addPanel).toHaveBeenCalledOnce();
    expect(api.addPanel).toHaveBeenCalledWith({
      id: getPanelIdForPath('code', '/vault/note.ts'),
      component: 'code',
      title: 'note.ts',
      params: { path: '/vault/note.ts' },
      position: {
        referencePanel: 'chat',
        direction: 'right',
      },
    });
  });
});
