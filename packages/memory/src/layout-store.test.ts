import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_LAYOUT_VERSION, hydrateLayoutRow, serializeLayoutState } from './layout-store.js';

const SAMPLE_LAYOUT_JSON = {
  global: {},
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 100,
        children: [
          { type: 'tab', id: 'chat-1', name: 'Chat', component: 'chat', config: { kind: 'chat' } },
        ],
      },
    ],
  },
};

const DEFAULT_PREFERENCES = {
  autoOpenAgentWrittenFiles: true,
  isLeftRailVisible: true,
  isRightInspectorVisible: false,
  activeRoute: 'workspace' as const,
  customMcps: [],
};

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
      workspace_state_json: JSON.stringify({ layoutJson: SAMPLE_LAYOUT_JSON }),
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
    const preferences = {
      autoOpenAgentWrittenFiles: false,
      isLeftRailVisible: true,
      isRightInspectorVisible: false,
      activeRoute: 'workspace' as const,
      customMcps: [],
    };
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: serializeLayoutState({
        version: CURRENT_LAYOUT_VERSION,
        layoutJson: SAMPLE_LAYOUT_JSON,
        updatedAt: '2026-04-15T00:00:00.000Z',
        preferences,
      }),
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toEqual({
      version: CURRENT_LAYOUT_VERSION,
      layoutJson: SAMPLE_LAYOUT_JSON,
      updatedAt: '2026-04-15T00:00:00.000Z',
      preferences,
    });
  });

  it('defaults preferences when loading a raw layout payload', () => {
    const row = {
      version: CURRENT_LAYOUT_VERSION,
      workspace_state_json: JSON.stringify({ layoutJson: SAMPLE_LAYOUT_JSON }),
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    expect(hydrateLayoutRow(row, 'user')).toEqual({
      version: CURRENT_LAYOUT_VERSION,
      layoutJson: SAMPLE_LAYOUT_JSON,
      updatedAt: '2026-04-15T00:00:00.000Z',
      preferences: DEFAULT_PREFERENCES,
    });
  });
});
