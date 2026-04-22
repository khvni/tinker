import { useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import {
  createWorkspaceStore,
  findActiveTab,
  selectWorkspaceSnapshot,
  type PaneRegistry,
  type WorkspaceStore,
  Workspace as PanesWorkspace,
} from '@tinker/panes';
import '@tinker/panes/styles.css';
import { Badge, Button } from '@tinker/design';
import { resolveVaultPath, type MemoryRunState } from '@tinker/memory';
import {
  createDefaultWorkspacePreferences,
  type LayoutStore,
  type MemoryStore,
  type ScheduledJobStore,
  type SkillStore,
  type SSOStatus,
  type TinkerPaneData,
  type TinkerPaneKind,
  type WorkspacePreferences,
} from '@tinker/shared-types';
import { DEFAULT_USER_ID, type OpencodeConnection } from '../../bindings.js';
import { IntegrationsStrip } from '../components/IntegrationsStrip.js';
import type { MCPStatus } from '../integrations.js';
import { isAbsolutePath, getPanelTitleForPath } from '../renderers/file-utils.js';
import { ChatPaneRuntimeContext } from './chat-pane-runtime.js';
import { openNewChatPanel } from './chat-panels.js';
import { openWorkspaceFile } from './file-open.js';
import { createDefaultWorkspaceState } from './layout.default.js';
import { getRenderer } from './pane-registry.js';

const LAYOUT_SAVE_DEBOUNCE_MS = 300;

type WorkspaceProps = {
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  schedulerStore: ScheduledJobStore;
  schedulerRevision: number;
  skillStore: SkillStore;
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  githubAuthBusy: boolean;
  githubAuthMessage: string | null;
  opencode: OpencodeConnection;
  sessions: SSOStatus;
  mcpStatus: Record<string, MCPStatus>;
  vaultPath: string | null;
  vaultRevision: number;
  activeSkillsRevision: number;
  memorySweepState: MemoryRunState | null;
  memorySweepBusy: boolean;
  onConnectModel(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onConnectGithub(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onDisconnectGithub(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
  onActiveSkillsChanged(): void;
  onRunScheduledJobNow(jobId: string): Promise<void>;
  onSchedulerChanged(): void;
  onRunMemorySweep(): Promise<void>;
  onMemoryCommitted(): void;
};

const createWorkspaceTabId = (): string => {
  return `workspace-${crypto.randomUUID()}`;
};

const createUtilityPane = (kind: 'settings' | 'memory') => {
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    kind,
    title: kind === 'settings' ? 'Settings' : 'Memory',
    data: { kind } as Extract<TinkerPaneData, { readonly kind: typeof kind }>,
  };
};

const requirePaneData = <K extends TinkerPaneKind>(
  kind: K,
  data: TinkerPaneData,
): Extract<TinkerPaneData, { readonly kind: K }> => {
  if (data.kind !== kind) {
    throw new Error(`Pane kind mismatch: expected "${kind}" but received "${data.kind}".`);
  }

  return data as Extract<TinkerPaneData, { readonly kind: K }>;
};

export const Workspace = ({
  layoutStore,
  skillStore,
  modelConnected,
  opencode,
  sessions,
  mcpStatus,
  vaultPath,
  activeSkillsRevision,
  onMemoryCommitted,
}: WorkspaceProps): JSX.Element => {
  const workspaceStoreRef = useRef<WorkspaceStore<TinkerPaneData> | null>(null);
  if (!workspaceStoreRef.current) {
    workspaceStoreRef.current = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });
  }
  const workspaceStore = workspaceStoreRef.current;
  const saveTimerRef = useRef<number | null>(null);
  const vaultPathRef = useRef<string | null>(vaultPath);
  const workspacePreferencesRef = useRef<WorkspacePreferences>(createDefaultWorkspacePreferences());

  useEffect(() => {
    vaultPathRef.current = vaultPath;
  }, [vaultPath]);

  const resolveAgentPath = useCallback((reportedPath: string): string | null => {
    if (isAbsolutePath(reportedPath)) {
      return reportedPath;
    }

    const activeVault = vaultPathRef.current;
    if (!activeVault) {
      return null;
    }

    try {
      return resolveVaultPath(activeVault, reportedPath);
    } catch (error) {
      console.warn(`Ignoring agent file event with unsafe path "${reportedPath}".`, error);
      return null;
    }
  }, []);

  const openFileInWorkspace = useCallback(
    (reportedPath: string): void => {
      const absolutePath = resolveAgentPath(reportedPath);
      if (!absolutePath) {
        return;
      }

      openWorkspaceFile(workspaceStore, absolutePath);
    },
    [resolveAgentPath, workspaceStore],
  );

  const openNewChatPane = useCallback((): void => {
    openNewChatPanel(workspaceStore);
  }, [workspaceStore]);

  const handleAgentFileWritten = useCallback(
    (reportedPath: string): void => {
      if (!workspacePreferencesRef.current.autoOpenAgentWrittenFiles) {
        return;
      }

      openFileInWorkspace(reportedPath);
    },
    [openFileInWorkspace],
  );

  const saveLayoutNow = useCallback((): void => {
    const snapshot = selectWorkspaceSnapshot(workspaceStore.getState());

    void layoutStore
      .save(DEFAULT_USER_ID, {
        version: snapshot.version,
        workspaceState: snapshot,
        updatedAt: new Date().toISOString(),
        preferences: workspacePreferencesRef.current,
      })
      .catch((error) => {
        console.warn('Failed to persist workspace layout.', error);
      });
  }, [layoutStore, workspaceStore]);

  const scheduleLayoutSave = useCallback((): void => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveLayoutNow();
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  }, [saveLayoutNow]);

  useEffect(() => {
    let active = true;
    const unsubscribe = workspaceStore.subscribe(() => {
      scheduleLayoutSave();
    });

    void (async () => {
      try {
        const savedLayout = await layoutStore.load(DEFAULT_USER_ID);
        if (!active) {
          return;
        }

        workspacePreferencesRef.current = savedLayout?.preferences ?? createDefaultWorkspacePreferences();

        if (savedLayout) {
          try {
            workspaceStore.getState().actions.hydrate(savedLayout.workspaceState);
          } catch (error) {
            console.warn('Stored workspace layout could not be hydrated. Falling back to default.', error);
            workspaceStore.getState().actions.hydrate(createDefaultWorkspaceState());
          }
        }
      } catch (error) {
        console.warn('Failed to load saved workspace layout. Falling back to default.', error);
      }

      scheduleLayoutSave();
    })();

    return () => {
      active = false;
      unsubscribe();

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      saveLayoutNow();
    };
  }, [layoutStore, saveLayoutNow, scheduleLayoutSave, workspaceStore]);

  const openOrFocusPane = useCallback(
    (kind: 'settings' | 'memory'): void => {
      const state = workspaceStore.getState();
      const activeTab = findActiveTab(state) ?? state.tabs[0] ?? null;

      if (!activeTab) {
        state.actions.openTab({
          id: createWorkspaceTabId(),
          pane: createUtilityPane(kind),
        });
        return;
      }

      const existingPane = Object.values(activeTab.panes).find((pane) => pane.kind === kind);
      if (existingPane) {
        state.actions.focusPane(activeTab.id, existingPane.id);
        return;
      }

      state.actions.addPane(activeTab.id, createUtilityPane(kind), { activate: true });
    },
    [workspaceStore],
  );

  const openSettingsPane = useCallback((): void => {
    openOrFocusPane('settings');
  }, [openOrFocusPane]);

  const openMemoryPane = useCallback((): void => {
    openOrFocusPane('memory');
  }, [openOrFocusPane]);

  const registry = useMemo<PaneRegistry<TinkerPaneData>>(() => {
    return {
      chat: {
        kind: 'chat',
        defaultTitle: 'Chat',
        render: ({ pane }) => <>{getRenderer('chat')(requirePaneData('chat', pane.data))}</>,
      },
      file: {
        kind: 'file',
        defaultTitle: (pane) => getPanelTitleForPath(requirePaneData('file', pane.data).path),
        render: ({ pane }) => <>{getRenderer('file')(requirePaneData('file', pane.data))}</>,
      },
      settings: {
        kind: 'settings',
        defaultTitle: 'Settings',
        render: ({ pane }) => <>{getRenderer('settings')(requirePaneData('settings', pane.data))}</>,
      },
      memory: {
        kind: 'memory',
        defaultTitle: 'Memory',
        render: ({ pane }) => <>{getRenderer('memory')(requirePaneData('memory', pane.data))}</>,
      },
    };
  }, []);

  const chatPaneRuntime = useMemo(
    () => ({
      skillStore,
      modelConnected,
      opencode,
      vaultPath,
      activeSkillsRevision,
      onFileWritten: handleAgentFileWritten,
      onOpenNewChat: openNewChatPane,
      onMemoryCommitted,
    }),
    [
      activeSkillsRevision,
      handleAgentFileWritten,
      modelConnected,
      onMemoryCommitted,
      openNewChatPane,
      opencode,
      skillStore,
      vaultPath,
    ],
  );

  return (
    <main className="tinker-workspace-shell">
      <header className="tinker-header">
        <div>
          <p className="tinker-eyebrow">Workspace</p>
          <h1>Tinker</h1>
        </div>
        <div className="tinker-inline-actions">
          <Button variant="secondary" size="s" onClick={openNewChatPane}>
            New chat
          </Button>
          <Button variant="secondary" size="s" onClick={openMemoryPane}>
            Memory
          </Button>
          <Button variant="secondary" size="s" onClick={openSettingsPane}>
            Settings
          </Button>
        </div>
        <div className="tinker-header-meta">
          <Badge variant={modelConnected ? 'success' : 'default'} size="small">
            {modelConnected ? 'Model connected' : 'Model disconnected'}
          </Badge>
          <Badge variant="default" size="small">
            {sessions.google?.email ?? sessions.github?.email ?? 'Offline mode'}
          </Badge>
          <Badge variant="default" size="small">
            {vaultPath ?? 'No vault selected'}
          </Badge>
        </div>
      </header>

      <div className="tinker-workspace-integrations">
        <IntegrationsStrip compact mcpStatus={mcpStatus} sessions={sessions} />
      </div>

      <ChatPaneRuntimeContext.Provider value={chatPaneRuntime}>
        <PanesWorkspace store={workspaceStore} registry={registry} ariaLabel="Tinker workspace" />
      </ChatPaneRuntimeContext.Provider>
    </main>
  );
};
