import {
  createDefaultWorkspacePreferences,
  type LayoutState,
  type LayoutStore,
  type PersistedWorkspaceState,
  type WorkspacePreferences,
} from '@tinker/shared-types';
import { getDatabase } from './database.js';

export type LayoutRow = {
  version: number;
  dockview_model_json: string;
  updated_at: string;
};

export const CURRENT_LAYOUT_VERSION = 2 as const;

type StoredLayoutPayload = {
  workspaceState: unknown;
  preferences?: unknown;
};

const parseStoredLayout = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const normalizePreferences = (value: unknown): WorkspacePreferences => {
  if (!value || typeof value !== 'object') {
    return createDefaultWorkspacePreferences();
  }

  const candidate = value as Record<string, unknown>;
  return {
    autoOpenAgentWrittenFiles:
      typeof candidate.autoOpenAgentWrittenFiles === 'boolean'
        ? candidate.autoOpenAgentWrittenFiles
        : createDefaultWorkspacePreferences().autoOpenAgentWrittenFiles,
  };
};

const isWorkspaceState = (value: unknown): value is PersistedWorkspaceState => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === CURRENT_LAYOUT_VERSION &&
    Array.isArray(candidate.tabs) &&
    ('activeTabId' in candidate)
  );
};

export const serializeLayoutState = (state: LayoutState): string => {
  const payload: StoredLayoutPayload = {
    workspaceState: state.workspaceState,
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

  const payload = parseStoredLayout(row.dockview_model_json);
  if (!payload || typeof payload !== 'object') {
    console.warn(`Ignoring stored layout for user ${userId}: payload was not valid JSON.`);
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const hasWrapper = 'workspaceState' in candidate;
  const workspaceState = hasWrapper ? candidate.workspaceState : payload;
  const preferences = hasWrapper ? normalizePreferences(candidate.preferences) : createDefaultWorkspacePreferences();

  if (!isWorkspaceState(workspaceState)) {
    console.warn(`Ignoring stored layout for user ${userId}: payload was not a WorkspaceState snapshot.`);
    return null;
  }

  return {
    version: CURRENT_LAYOUT_VERSION,
    workspaceState,
    updatedAt: row.updated_at,
    preferences,
  };
};

export const createLayoutStore = (): LayoutStore => {
  return {
    async load(userId: string): Promise<LayoutState | null> {
      const database = await getDatabase();
      const rows = await database.select<LayoutRow[]>(
        `SELECT version, dockview_model_json, updated_at
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
        `INSERT INTO layouts (user_id, version, dockview_model_json, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(user_id) DO UPDATE SET
           version = excluded.version,
           dockview_model_json = excluded.dockview_model_json,
           updated_at = excluded.updated_at`,
        [userId, state.version, serializeLayoutState(state), state.updatedAt],
      );
    },
  };
};
