import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_LAYOUT_VERSION, hydrateLayoutRow, serializeLayoutState } from './layout-store.js';

describe('hydrateLayoutRow', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns null when no row is stored', () => {
    expect(hydrateLayoutRow(undefined, 'user')).toBeNull();
  });

  it('returns null and warns when the stored version is incompatible', () => {
    const row = {
      version: CURRENT_LAYOUT_VERSION + 1,
      workspace_state_json: '{"tabs":[],"activeTabId":null,"version":2}',
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns null and warns when the payload is not valid JSON', () => {
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: '{ not json',
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns null when the payload is valid JSON but not an object', () => {
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: 'null',
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toBeNull();
  });

  it('round-trips a persisted layout including workspace preferences', () => {
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: serializeLayoutState({
        version: CURRENT_LAYOUT_VERSION,
        workspaceState: {
          version: CURRENT_LAYOUT_VERSION,
          tabs: [],
          activeTabId: null,
        },
        updatedAt: '2026-04-15T00:00:00.000Z',
        preferences: {
          autoOpenAgentWrittenFiles: false,
          isLeftRailVisible: true,
          isRightInspectorVisible: false,
          activeRoute: 'connections',
        },
      }),
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toEqual({
      version: CURRENT_LAYOUT_VERSION,
      workspaceState: {
        version: CURRENT_LAYOUT_VERSION,
        tabs: [],
        activeTabId: null,
      },
      updatedAt: '2026-04-15T00:00:00.000Z',
      preferences: {
        autoOpenAgentWrittenFiles: false,
        isLeftRailVisible: true,
        isRightInspectorVisible: false,
        activeRoute: 'connections',
      },
    });
  });

  it('defaults auto-open on when loading a raw workspace payload', () => {
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: '{"version":2,"tabs":[],"activeTabId":null}',
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toEqual({
      version: CURRENT_LAYOUT_VERSION,
      workspaceState: {
        version: CURRENT_LAYOUT_VERSION,
        tabs: [],
        activeTabId: null,
      },
      updatedAt: '2026-04-15T00:00:00.000Z',
      preferences: {
        autoOpenAgentWrittenFiles: true,
        isLeftRailVisible: true,
        isRightInspectorVisible: false,
        activeRoute: 'workspace',
      },
    });
  });

  it('drops route-only utility panes from serialized workspace snapshots', () => {
    const workspaceStateJson = JSON.stringify({
      workspaceState: {
        version: CURRENT_LAYOUT_VERSION,
        activeTabId: 'tab-1',
        tabs: [
          {
            id: 'tab-1',
            createdAt: 1,
            layout: {
              kind: 'stack',
              id: 'stack-1',
              paneIds: ['chat-1', 'memory-1'],
              activePaneId: 'memory-1',
            },
            panes: {
              'chat-1': {
                id: 'chat-1',
                kind: 'chat',
                data: { kind: 'chat' },
              },
              'memory-1': {
                id: 'memory-1',
                kind: 'memory',
                data: { kind: 'memory' },
              },
            },
            activePaneId: 'memory-1',
            activeStackId: 'stack-1',
          },
        ],
      },
      preferences: {
        autoOpenAgentWrittenFiles: true,
        isLeftRailVisible: true,
        isRightInspectorVisible: false,
        activeRoute: 'memory',
      },
    });
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: workspaceStateJson,
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toMatchObject({
      preferences: {
        activeRoute: 'memory',
      },
      workspaceState: {
        tabs: [
          {
            layout: {
              kind: 'stack',
              paneIds: ['chat-1'],
              activePaneId: 'chat-1',
            },
            activePaneId: 'chat-1',
            panes: {
              'chat-1': {
                data: { kind: 'chat' },
              },
            },
          },
        ],
      },
    });
  });

  it('drops route-only utility panes before serializing workspace snapshots', () => {
    const serialized = serializeLayoutState({
      version: CURRENT_LAYOUT_VERSION,
      workspaceState: {
        version: CURRENT_LAYOUT_VERSION,
        activeTabId: 'tab-1',
        tabs: [
          {
            id: 'tab-1',
            createdAt: 1,
            layout: {
              kind: 'stack',
              id: 'stack-1',
              paneIds: ['chat-1'],
              activePaneId: 'chat-1',
            },
            panes: {
              'chat-1': {
                id: 'chat-1',
                kind: 'chat',
                data: { kind: 'chat' },
              },
            },
            activePaneId: 'chat-1',
            activeStackId: 'stack-1',
          },
        ],
      },
      updatedAt: '2026-04-15T00:00:00.000Z',
      preferences: {
        autoOpenAgentWrittenFiles: true,
        isLeftRailVisible: true,
        isRightInspectorVisible: false,
        activeRoute: 'memory',
      },
    });
    const parsed = JSON.parse(serialized) as {
      readonly workspaceState: {
        readonly tabs: ReadonlyArray<{
          readonly layout: { readonly paneIds: ReadonlyArray<string> };
        }>;
      };
    };

    expect(parsed.workspaceState.tabs[0]?.layout.paneIds).toEqual(['chat-1']);
  });
});
