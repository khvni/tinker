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
  workspace_state_json: string | null;
  updated_at: string;
};

export const CURRENT_LAYOUT_VERSION = 2 as const;

type StoredLayoutPayload = {
  workspaceState: unknown;
  preferences?: unknown;
};

type PaneDataRecord = {
  readonly kind?: unknown;
};

type PersistedTab = PersistedWorkspaceState['tabs'][number];
type PersistedPane = PersistedTab['panes'][string];
type PersistedLayoutNode = PersistedTab['layout'];

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

const isPaneDataRecord = (value: unknown): value is PaneDataRecord => {
  return Boolean(value && typeof value === 'object');
};

const isPersistablePane = (pane: PersistedPane): boolean => {
  return isPaneDataRecord(pane.data) && (pane.data.kind === 'chat' || pane.data.kind === 'file');
};

const pruneLayoutNode = (
  node: PersistedLayoutNode,
  paneIds: ReadonlySet<string>,
): PersistedLayoutNode | null => {
  if (node.kind === 'stack') {
    const retainedPaneIds = node.paneIds.filter((paneId) => paneIds.has(paneId));
    if (retainedPaneIds.length === 0) {
      return null;
    }

    return {
      ...node,
      paneIds: retainedPaneIds,
      activePaneId:
        node.activePaneId && retainedPaneIds.includes(node.activePaneId)
          ? node.activePaneId
          : (retainedPaneIds[0] ?? null),
    };
  }

  const a = pruneLayoutNode(node.a, paneIds);
  const b = pruneLayoutNode(node.b, paneIds);

  if (a && b) {
    return { ...node, a, b };
  }

  return a ?? b;
};

const collectStackIds = (node: PersistedLayoutNode): ReadonlyArray<string> => {
  if (node.kind === 'stack') {
    return [node.id];
  }

  return [...collectStackIds(node.a), ...collectStackIds(node.b)];
};

const sanitizeTab = (tab: PersistedTab): PersistedTab | null => {
  const panes = Object.fromEntries(
    Object.entries(tab.panes).filter((entry): entry is [string, PersistedPane] => {
      const [, pane] = entry;
      return isPersistablePane(pane);
    }),
  ) as Record<string, PersistedPane>;
  const retainedPaneIds = new Set(Object.keys(panes));
  const layout = pruneLayoutNode(tab.layout, retainedPaneIds);

  if (!layout || Object.keys(panes).length === 0) {
    return null;
  }

  const stackIds = collectStackIds(layout);
  const firstStackId = stackIds[0] ?? null;

  return {
    ...tab,
    layout,
    panes,
    activePaneId:
      tab.activePaneId && retainedPaneIds.has(tab.activePaneId)
        ? tab.activePaneId
        : (Object.keys(panes)[0] ?? null),
    activeStackId:
      tab.activeStackId && stackIds.includes(tab.activeStackId)
        ? tab.activeStackId
        : firstStackId,
  };
};

const sanitizeWorkspaceState = (state: PersistedWorkspaceState): PersistedWorkspaceState => {
  const tabs = state.tabs.map(sanitizeTab).filter((tab): tab is NonNullable<ReturnType<typeof sanitizeTab>> => tab !== null);
  const tabIds = new Set(tabs.map((tab) => tab.id));

  return {
    ...state,
    tabs,
    activeTabId: state.activeTabId && tabIds.has(state.activeTabId) ? state.activeTabId : (tabs[0]?.id ?? null),
  };
};

export const serializeLayoutState = (state: LayoutState): string => {
  const payload: StoredLayoutPayload = {
    workspaceState: sanitizeWorkspaceState(state.workspaceState),
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
  const hasWrapper = 'workspaceState' in candidate;
  const workspaceState = hasWrapper ? candidate.workspaceState : payload;
  const preferences = hasWrapper ? normalizePreferences(candidate.preferences) : createDefaultWorkspacePreferences();

  if (!isWorkspaceState(workspaceState)) {
    console.warn(`Ignoring stored layout for user ${userId}: payload was not a WorkspaceState snapshot.`);
    return null;
  }

  return {
    version: CURRENT_LAYOUT_VERSION,
    workspaceState: sanitizeWorkspaceState(workspaceState),
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
