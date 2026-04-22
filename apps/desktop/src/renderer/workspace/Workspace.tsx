import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createAttentionStore, type FlashReason } from '@tinker/attention';
import {
  createWorkspaceStore,
  findActiveTab,
  selectWorkspaceSnapshot,
  useWorkspaceSelector,
  type PaneRegistry,
  type WorkspaceStore,
  Workspace as PanesWorkspace,
} from '@tinker/panes';
import '@tinker/panes/styles.css';
import type { MemoryRunState } from '@tinker/memory';
import {
  createDefaultWorkspacePreferences,
  type LayoutStore,
  type MemoryStore,
  type ScheduledJobStore,
  type SkillStore,
  type SSOSession,
  type SSOStatus,
  type TinkerPaneData,
  type TinkerPaneKind,
  type User,
  type WorkspacePreferences,
} from '@tinker/shared-types';
import type { OpencodeConnection } from '../../bindings.js';
import { resolveWorkspaceFilePath } from '../file-links.js';
import { BUILTIN_MCP_NAMES, type BuiltinMcpName, type MCPStatus } from '../integrations.js';
import { FilePaneRuntimeContext } from '../panes/FilePane/file-pane-runtime.js';
import { isAbsolutePath, getPanelTitleForPath } from '../renderers/file-utils.js';
import { ChatPaneRuntimeContext } from './chat-pane-runtime.js';
import { RegisteredChatPane } from './components/RegisteredChatPane/index.js';
import { Titlebar } from './components/Titlebar/index.js';
import { WorkspaceShell } from './components/WorkspaceShell/index.js';
import { WorkspaceSidebar } from './components/WorkspaceSidebar/index.js';
import { openNewChatPanel } from './chat-panels.js';
import { openWorkspaceFile } from './file-open.js';
import { createDefaultWorkspaceState } from './layout.default.js';
import { MemoryPaneRuntimeContext } from './memory-pane-runtime.js';
import { getRenderer } from './pane-registry.js';
import {
  SettingsPaneRuntimeContext,
  pickActiveSession,
  type SettingsPaneRuntime,
} from './settings-pane-runtime.js';

const LAYOUT_SAVE_DEBOUNCE_MS = 300;
const DESKTOP_WORKSPACE_ATTENTION_ID = 'desktop-workspace';

type WorkspaceProps = {
  currentUserId: string;
  currentUserName: string;
  currentUserProvider: User['provider'];
  currentUserEmail: string | null;
  currentUserAvatarUrl: string | null;
  nativeRuntimeAvailable: boolean;
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  schedulerStore: ScheduledJobStore;
  schedulerRevision: number;
  skillStore: SkillStore;
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  guestBusy: boolean;
  guestMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  githubAuthBusy: boolean;
  githubAuthMessage: string | null;
  microsoftAuthBusy: boolean;
  microsoftAuthMessage: string | null;
  opencode: OpencodeConnection;
  sessions: SSOStatus;
  mcpStatus: Record<string, MCPStatus>;
  vaultPath: string | null;
  vaultRevision: number;
  activeSkillsRevision: number;
  memorySweepState: MemoryRunState | null;
  memorySweepBusy: boolean;
  onContinueAsGuest(): Promise<void>;
  sessionFolderBusy: boolean;
  onSelectSessionFolder(): Promise<void>;
  onContinueAsGuest(): Promise<void>;
  onConnectModel(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onConnectGithub(): Promise<void>;
  onConnectMicrosoft(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onDisconnectGithub(): Promise<void>;
  onDisconnectMicrosoft(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
  onActiveSkillsChanged(): void;
  onRunScheduledJobNow(jobId: string): Promise<void>;
  onSchedulerChanged(): void;
  onRunMemorySweep(): Promise<void>;
  onMemoryCommitted(): void;
  onRequestMcpRespawn(): Promise<void>;
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
  currentUserId,
  currentUserName,
  currentUserProvider,
  currentUserEmail,
  currentUserAvatarUrl,
  nativeRuntimeAvailable,
  layoutStore,
  skillStore,
  modelConnected,
  modelAuthBusy,
  modelAuthMessage,
  guestBusy,
  guestMessage,
  sessionFolderBusy,
  onSelectSessionFolder,
  googleAuthBusy,
  googleAuthMessage,
  githubAuthBusy,
  githubAuthMessage,
  microsoftAuthBusy,
  microsoftAuthMessage,
  opencode,
  sessions,
  vaultPath,
  vaultRevision,
  activeSkillsRevision,
  onContinueAsGuest,
  onConnectModel,
  onDisconnectModel,
  onConnectGoogle,
  onConnectGithub,
  onConnectMicrosoft,
  onDisconnectGoogle,
  onDisconnectGithub,
  onDisconnectMicrosoft,
  onMemoryCommitted,
  mcpStatus,
  onRequestMcpRespawn,
}: WorkspaceProps): JSX.Element => {
  const workspaceStoreRef = useRef<WorkspaceStore<TinkerPaneData> | null>(null);
  const attentionStoreRef = useRef(createAttentionStore());
  if (!workspaceStoreRef.current) {
    workspaceStoreRef.current = createWorkspaceStore<TinkerPaneData>({
      initial: createDefaultWorkspaceState(),
    });
  }
  const workspaceStore = workspaceStoreRef.current;
  const attentionStore = attentionStoreRef.current;
  const saveTimerRef = useRef<number | null>(null);
  const vaultPathRef = useRef<string | null>(vaultPath);
  const workspacePreferencesRef = useRef<WorkspacePreferences>(createDefaultWorkspacePreferences());
  const [workspacePreferences, setWorkspacePreferences] = useState<WorkspacePreferences>(
    createDefaultWorkspacePreferences(),
  );

  const activeRailItem = useWorkspaceSelector<TinkerPaneData, TinkerPaneKind | null>(
    workspaceStore,
    (state) => {
      if (!state.activeTabId) return null;
      const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId);
      if (!tab || !tab.activePaneId) return null;
      return tab.panes[tab.activePaneId]?.data.kind ?? null;
    },
  );

  useEffect(() => {
    vaultPathRef.current = vaultPath;
  }, [vaultPath]);

  useEffect(() => {
    workspacePreferencesRef.current = workspacePreferences;
  }, [workspacePreferences]);

  const resolveAgentPath = useCallback((reportedPath: string): string | null => {
    const resolvedPath = resolveWorkspaceFilePath(reportedPath, vaultPathRef.current);
    if (resolvedPath) {
      return resolvedPath;
    }

    if (!vaultPathRef.current && !isAbsolutePath(reportedPath)) {
      console.warn(`Ignoring file link "${reportedPath}" because no active session folder is available.`);
      return null;
    }

    console.warn(`Ignoring unsafe file link "${reportedPath}".`);
    return null;
  }, []);

  const openFileInWorkspace = useCallback(
    (reportedPath: string, options?: { mime?: string }): void => {
      const absolutePath = resolveAgentPath(reportedPath);
      if (!absolutePath) {
        return;
      }

      if (options?.mime) {
        void openWorkspaceFile(workspaceStore, absolutePath, async () => options.mime ?? 'application/octet-stream');
        return;
      }

      void openWorkspaceFile(workspaceStore, absolutePath);
    },
    [resolveAgentPath, workspaceStore],
  );

  const openNewChatPane = useCallback((): void => {
    openNewChatPanel(workspaceStore);
  }, [workspaceStore]);

  const signalPaneAttention = useCallback(
    (paneId: string, reason: FlashReason): void => {
      attentionStore.getState().actions.signal({
        workspaceId: DESKTOP_WORKSPACE_ATTENTION_ID,
        paneId,
        reason,
      });
    },
    [attentionStore],
  );

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
      .save(currentUserId, {
        version: snapshot.version,
        workspaceState: snapshot,
        updatedAt: new Date().toISOString(),
        preferences: workspacePreferencesRef.current,
      })
      .catch((error) => {
        console.warn('Failed to persist workspace layout.', error);
      });
  }, [currentUserId, layoutStore, workspaceStore]);

  const scheduleLayoutSave = useCallback((): void => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveLayoutNow();
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  }, [saveLayoutNow]);

  const handleWorkspacePreferencesChange = useCallback((nextPreferences: WorkspacePreferences): void => {
    workspacePreferencesRef.current = nextPreferences;
    setWorkspacePreferences(nextPreferences);
    scheduleLayoutSave();
  }, [scheduleLayoutSave]);

  useEffect(() => {
    let active = true;
    const unsubscribe = workspaceStore.subscribe(() => {
      scheduleLayoutSave();
    });

    void (async () => {
      try {
        const savedLayout = await layoutStore.load(currentUserId);
        if (!active) {
          return;
        }

        const nextPreferences = savedLayout?.preferences ?? createDefaultWorkspacePreferences();
        workspacePreferencesRef.current = nextPreferences;
        setWorkspacePreferences(nextPreferences);

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
  }, [currentUserId, layoutStore, saveLayoutNow, scheduleLayoutSave, workspaceStore]);

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
        render: ({ pane, tabId, isActive }) => (
          <RegisteredChatPane
            tabId={tabId}
            paneId={pane.id}
            isActive={isActive}
            paneData={requirePaneData('chat', pane.data)}
            onAttentionSignal={(reason) => signalPaneAttention(pane.id, reason)}
          />
        ),
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
  }, [signalPaneAttention]);

  const chatPaneRuntime = useMemo(
    () => ({
      skillStore,
      currentUserId,
      modelConnected,
      opencode,
      sessionFolderPath: vaultPath,
      vaultPath,
      activeSkillsRevision,
      sessionFolderBusy,
      onSelectSessionFolder,
      onFileWritten: handleAgentFileWritten,
      onOpenFileLink: openFileInWorkspace,
      onOpenNewChat: openNewChatPane,
      onMemoryCommitted,
    }),
    [
      activeSkillsRevision,
      currentUserId,
      handleAgentFileWritten,
      modelConnected,
      onMemoryCommitted,
      onSelectSessionFolder,
      openFileInWorkspace,
      openNewChatPane,
      opencode,
      sessionFolderBusy,
      vaultPath,
      skillStore,
    ],
  );

  const filePaneRuntime = useMemo(
    () => ({
      vaultRevision,
      openFile: openFileInWorkspace,
    }),
    [openFileInWorkspace, vaultRevision],
  );

  const settingsPaneRuntime = useMemo<SettingsPaneRuntime>(() => {
    const activeSession = pickActiveSession(sessions);

    const busyByProvider: Record<SSOSession['provider'], boolean> = {
      google: googleAuthBusy,
      github: githubAuthBusy,
      microsoft: microsoftAuthBusy,
    };
    const messageByProvider: Record<SSOSession['provider'], string | null> = {
      google: googleAuthMessage,
      github: githubAuthMessage,
      microsoft: microsoftAuthMessage,
    };
    const disconnectByProvider: Record<SSOSession['provider'], () => Promise<void>> = {
      google: onDisconnectGoogle,
      github: onDisconnectGithub,
      microsoft: onDisconnectMicrosoft,
    };

    const mcpSeedStatuses: Partial<Record<BuiltinMcpName, MCPStatus>> = {};
    for (const name of BUILTIN_MCP_NAMES) {
      const seeded = mcpStatus[name];
      if (seeded) {
        mcpSeedStatuses[name] = seeded;
      }
    }

    return {
      nativeRuntimeAvailable,
      currentUserName,
      currentUserProvider,
      currentUserEmail,
      currentUserAvatarUrl,
      sessions,
      activeSession,
      signOutBusy: activeSession ? busyByProvider[activeSession.provider] : false,
      signOutMessage: activeSession ? messageByProvider[activeSession.provider] : null,
      guestBusy,
      guestMessage,
      providerBusy: {
        google: googleAuthBusy,
        github: githubAuthBusy,
        microsoft: microsoftAuthBusy,
      },
      providerMessages: {
        google: googleAuthMessage,
        github: githubAuthMessage,
        microsoft: microsoftAuthMessage,
      },
      modelConnected,
      modelAuthBusy,
      modelAuthMessage,
      workspacePreferences,
      opencode,
      vaultPath,
      mcpSeedStatuses,
      onSignOut: async (session: SSOSession) => {
        await disconnectByProvider[session.provider]();
      },
      onContinueAsGuest,
      onConnectGoogle,
      onConnectGithub,
      onConnectMicrosoft,
      onConnectModel,
      onDisconnectModel,
      onWorkspacePreferencesChange: handleWorkspacePreferencesChange,
      onRequestRespawn: onRequestMcpRespawn,
    };
  }, [
    nativeRuntimeAvailable,
    currentUserName,
    currentUserProvider,
    currentUserEmail,
    currentUserAvatarUrl,
    sessions,
    googleAuthBusy,
    googleAuthMessage,
    githubAuthBusy,
    githubAuthMessage,
    microsoftAuthBusy,
    microsoftAuthMessage,
    guestBusy,
    guestMessage,
    modelConnected,
    modelAuthBusy,
    modelAuthMessage,
    onContinueAsGuest,
    onConnectGoogle,
    onConnectGithub,
    onConnectMicrosoft,
    onConnectModel,
    onDisconnectGoogle,
    onDisconnectGithub,
    onDisconnectMicrosoft,
    onDisconnectModel,
    workspacePreferences,
    handleWorkspacePreferencesChange,
    opencode,
    vaultPath,
    mcpStatus,
    onRequestMcpRespawn,
  ]);

  const userInitial = (currentUserId.trim()[0] ?? 'T').toUpperCase();
  const isGuest = currentUserProvider === 'local';
  const accountLabel = isGuest
    ? 'Account · Guest'
    : `Account · ${currentUserEmail ?? currentUserName}`;

  return (
    <WorkspaceShell
      titlebar={
        <Titlebar
          sessionFolderPath={vaultPath}
          onNewSession={openNewChatPane}
          onOpenMemory={openMemoryPane}
          onOpenSettings={openSettingsPane}
        />
      }
      sidebar={
        <WorkspaceSidebar
          userInitial={userInitial}
          avatarUrl={currentUserAvatarUrl}
          accountLabel={accountLabel}
          activeRailItem={activeRailItem}
          onOpenChat={openNewChatPane}
          onOpenMemory={openMemoryPane}
          onOpenSettings={openSettingsPane}
          onOpenAccount={openSettingsPane}
        />
      }
    >
      <ChatPaneRuntimeContext.Provider value={chatPaneRuntime}>
        <SettingsPaneRuntimeContext.Provider value={settingsPaneRuntime}>
          <MemoryPaneRuntimeContext.Provider value={{ currentUserId }}>
            <FilePaneRuntimeContext.Provider value={filePaneRuntime}>
              <PanesWorkspace
                store={workspaceStore}
                registry={registry}
                attention={{
                  store: attentionStore,
                  workspaceId: DESKTOP_WORKSPACE_ATTENTION_ID,
                }}
                ariaLabel="Tinker workspace"
              />
            </FilePaneRuntimeContext.Provider>
          </MemoryPaneRuntimeContext.Provider>
        </SettingsPaneRuntimeContext.Provider>
      </ChatPaneRuntimeContext.Provider>
    </WorkspaceShell>
  );
};
