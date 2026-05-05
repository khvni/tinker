import {
  createDefaultWorkspacePreferences,
  type CustomMcpEntry,
  type LayoutState,
  type LayoutStore,
  type WorkspacePreferences,
} from '@tinker/shared-types';
import { getDatabase } from './database.js';

export type LayoutRow = {
  version: number;
  workspace_state_json: string | null;
  updated_at: string;
};

export const CURRENT_LAYOUT_VERSION = 4 as const;

type StoredLayoutPayload = {
  layoutJson: unknown;
  preferences?: unknown;
};

const parseStoredLayout = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const isValidMcpEntry = (entry: unknown): entry is CustomMcpEntry => {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    typeof record.url === 'string' &&
    typeof record.headerName === 'string' &&
    typeof record.enabled === 'boolean'
  );
};

const normalizePreferences = (value: unknown): WorkspacePreferences => {
  if (!value || typeof value !== 'object') {
    return createDefaultWorkspacePreferences();
  }

  const candidate = value as Record<string, unknown>;
  const defaults = createDefaultWorkspacePreferences();
  return {
    autoOpenAgentWrittenFiles:
      typeof candidate.autoOpenAgentWrittenFiles === 'boolean'
        ? candidate.autoOpenAgentWrittenFiles
        : defaults.autoOpenAgentWrittenFiles,
    isLeftRailVisible:
      typeof candidate.isLeftRailVisible === 'boolean'
        ? candidate.isLeftRailVisible
        : defaults.isLeftRailVisible,
    isRightInspectorVisible:
      typeof candidate.isRightInspectorVisible === 'boolean'
        ? candidate.isRightInspectorVisible
        : defaults.isRightInspectorVisible,
    activeRoute:
      candidate.activeRoute === 'workspace' ||
      candidate.activeRoute === 'memory' ||
      candidate.activeRoute === 'settings' ||
      candidate.activeRoute === 'connections'
        ? candidate.activeRoute
        : defaults.activeRoute,
    customMcps: Array.isArray(candidate.customMcps)
      ? (candidate.customMcps as unknown[]).filter(isValidMcpEntry)
      : defaults.customMcps,
  };
};

const isLayoutJson = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return 'layout' in candidate;
};

export const serializeLayoutState = (state: LayoutState): string => {
  const payload: StoredLayoutPayload = {
    layoutJson: state.layoutJson,
    preferences: state.preferences,
  };

  return JSON.stringify(payload);
};

export const hydrateLayoutRow = (row: LayoutRow | undefined, userId: string): LayoutState | null => {
  if (!row) {
    return null;
  }

  if (row.version !== CURRENT_LAYOUT_VERSION) {
    console.warn(
      `Ignoring stored layout for user ${userId}: version ${row.version} is not compatible with app version ${CURRENT_LAYOUT_VERSION}.`,
    );
    return null;
  }

  const payload = row.workspace_state_json ? parseStoredLayout(row.workspace_state_json) : null;
  if (!payload || typeof payload !== 'object') {
    console.warn(`Ignoring stored layout for user ${userId}: payload was not valid JSON.`);
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const hasWrapper = 'layoutJson' in candidate;
  const layoutJson = hasWrapper ? candidate.layoutJson : payload;
  const preferences = hasWrapper ? normalizePreferences(candidate.preferences) : createDefaultWorkspacePreferences();

  if (!isLayoutJson(layoutJson)) {
    console.warn(`Ignoring stored layout for user ${userId}: payload was not a valid FlexLayout model.`);
    return null;
  }

  return {
    version: CURRENT_LAYOUT_VERSION,
    layoutJson,
    updatedAt: row.updated_at,
    preferences,
  };
};

export const createLayoutStore = (): LayoutStore => {
  return {
    async load(userId: string): Promise<LayoutState | null> {
      const database = await getDatabase();
      const rows = await database.select<LayoutRow[]>(
        `SELECT version, workspace_state_json, updated_at
         FROM layouts
         WHERE user_id = $1
         LIMIT 1`,
        [userId],
      );

      return hydrateLayoutRow(rows[0], userId);
    },

    async save(userId: string, state: LayoutState): Promise<void> {
      const database = await getDatabase();

      await database.execute(
        `INSERT INTO layouts (user_id, version, workspace_state_json, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(user_id) DO UPDATE SET
           version = excluded.version,
           workspace_state_json = excluded.workspace_state_json,
           updated_at = excluded.updated_at`,
        [userId, state.version, serializeLayoutState(state), state.updatedAt],
      );
    },
  };
};
