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
import { getActiveMemoryPath, listSessionsForUser, type MemoryRunState } from '@tinker/memory';
import {
  createDefaultWorkspacePreferences,
  type LayoutStore,
  type MemoryStore,
  type ScheduledJobStore,
  type Session,
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
import { isAbsolutePath, getPanelTitleForPath } from '../renderers/file-utils.js';
import { ChatPaneRuntimeContext } from './chat-pane-runtime.js';
import { ConnectionsRoute } from './components/ConnectionsRoute/index.js';
import { MemoryRoute } from './components/MemoryRoute/index.js';
import { RegisteredChatPane } from './components/RegisteredChatPane/index.js';
import { SessionSwitcher } from './components/SessionSwitcher/index.js';
import { SettingsRoute } from './components/SettingsRoute/index.js';
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
  activeSkillsRevision: number;
  /**
   * Absolute root directory the skill store was initialized against. Passed
   * to the Playbook pane so the Git sync flow can target the same directory.
   */
  skillsRootPath: string | null;
  memorySweepState: MemoryRunState | null;
  memorySweepBusy: boolean;
  onContinueAsGuest(): Promise<void>;
  sessionFolderBusy: boolean;
  onSelectSessionFolder(): Promise<string | null>;
  onActivateSession(session: Session): Promise<void>;
  onConnectModel(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onConnectGithub(): Promise<void>;
  onConnectMicrosoft(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onDisconnectGithub(): Promise<void>;
  onDisconnectMicrosoft(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<string | null>;
  onActiveSkillsChanged(): void;
  onRunScheduledJobNow(jobId: string): Promise<void>;
  onSchedulerChanged(): void;
  onRunMemorySweep(): Promise<void>;
  onMemoryCommitted(): void;
  onRequestMcpRespawn(): Promise<void>;
  getConnectionForPane: (paneData: Extract<TinkerPaneData, { readonly kind: 'chat' }>) => OpencodeConnection;
  releaseConnectionForPane: (paneData: Extract<TinkerPaneData, { readonly kind: 'chat' }>) => void;
};

const createWorkspaceTabId = (): string => {
  return `workspace-${crypto.randomUUID()}`;
};

type WorkspaceRoute = WorkspacePreferences['activeRoute'];

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
  onActivateSession,
  googleAuthBusy,
  googleAuthMessage,
  githubAuthBusy,
  githubAuthMessage,
  microsoftAuthBusy,
  microsoftAuthMessage,
  opencode,
  sessions,
  vaultPath,
  activeSkillsRevision,
  skillsRootPath,
  onActiveSkillsChanged,
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
  getConnectionForPane,
  releaseConnectionForPane,
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
  const [pendingSettingsSectionId, setPendingSettingsSectionId] = useState<string | null>(null);
  const activeRoute = workspacePreferences.activeRoute;
  const [storedSessions, setStoredSessions] = useState<Session[]>([]);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [sessionSwitcherResolved, setSessionSwitcherResolved] = useState(false);

  const activeRailItem = useWorkspaceSelector<TinkerPaneData, TinkerPaneKind | null>(
    workspaceStore,
    (state) => {
      if (!state.activeTabId) return null;
      const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId);
      if (!tab || !tab.activePaneId) return null;
      return tab.panes[tab.activePaneId]?.data.kind ?? null;
    },
  );
  const resolvedActiveRailItem = activeRoute === 'workspace' ? activeRailItem : activeRoute;

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
      handleActiveRouteChange('workspace');
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
    [handleActiveRouteChange, resolveAgentPath, workspaceStore],
  );

  const openNewChatPane = useCallback((): void => {
    handleActiveRouteChange('workspace');
    openNewChatPanel(workspaceStore);
  }, [handleActiveRouteChange, workspaceStore]);

  const refreshStoredSessions = useCallback(async (): Promise<void> => {
    try {
      setSessionLoadError(null);
      setStoredSessions(await listSessionsForUser(currentUserId));
    } catch (error) {
      setSessionLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [currentUserId]);

  useEffect(() => {
    setSessionSwitcherResolved(false);
    void refreshStoredSessions();
  }, [refreshStoredSessions]);

  const openSessionChatPane = useCallback(
    async (session: Session): Promise<void> => {
      const memorySubdir = await getActiveMemoryPath(currentUserId);
      const state = workspaceStore.getState();
      const activeTab = findActiveTab(state) ?? state.tabs[0] ?? null;
      const title = getPanelTitleForPath(session.folderPath.replace(/[\\/]+$/u, ''));

      if (!activeTab) {
        state.actions.openTab({
          id: createWorkspaceTabId(),
          pane: {
            id: `chat-${session.id}`,
            kind: 'chat',
            title,
            data: {
              kind: 'chat',
              sessionId: session.id,
              folderPath: session.folderPath,
              memorySubdir,
            },
          },
        });
        return;
      }

      const existingPane = Object.values(activeTab.panes).find(
        (pane) => pane.data.kind === 'chat' && pane.data.sessionId === session.id,
      );
      if (existingPane) {
        state.actions.focusPane(activeTab.id, existingPane.id);
        return;
      }

      const activePaneId = activeTab.activePaneId;
      const activePane = activePaneId ? activeTab.panes[activePaneId] : null;
      if (activePane?.data.kind === 'chat' && !activePane.data.sessionId && !activePane.data.folderPath) {
        state.actions.updatePaneData(activeTab.id, activePane.id, () => ({
          kind: 'chat',
          sessionId: session.id,
          folderPath: session.folderPath,
          memorySubdir,
        }));
        state.actions.renamePane(activeTab.id, activePane.id, title);
        return;
      }

      state.actions.addPane(activeTab.id, {
        id: `chat-${session.id}`,
        kind: 'chat',
        title,
        data: {
          kind: 'chat',
          sessionId: session.id,
          folderPath: session.folderPath,
          memorySubdir,
        },
      });
    },
    [currentUserId, workspaceStore],
  );

  const handleCreateSessionFromSwitcher = useCallback((): void => {
    void (async () => {
      const folderPath = await onSelectSessionFolder();
      if (!folderPath) {
        return;
      }

      const memorySubdir = await getActiveMemoryPath(currentUserId);
      const title = getPanelTitleForPath(folderPath.replace(/[\\/]+$/u, ''));

      workspaceStore.getState().actions.openTab({
        id: createWorkspaceTabId(),
        pane: {
          id: `chat-${crypto.randomUUID()}`,
          kind: 'chat',
          title,
          data: { kind: 'chat', createFreshSession: true, folderPath, memorySubdir },
        },
      });

      setSessionSwitcherResolved(true);
      handleActiveRouteChange('workspace');
      await refreshStoredSessions();
    })();
  }, [currentUserId, handleActiveRouteChange, onSelectSessionFolder, refreshStoredSessions, workspaceStore]);

  const handleSelectStoredSession = useCallback(
    (session: Session): void => {
      void (async () => {
        await onActivateSession(session);
        await openSessionChatPane(session);
        setSessionSwitcherResolved(true);
        handleActiveRouteChange('workspace');
        await refreshStoredSessions();
      })();
    },
    [handleActiveRouteChange, onActivateSession, openSessionChatPane, refreshStoredSessions],
  );

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

  function handleActiveRouteChange(nextRoute: WorkspaceRoute): void {
    const current = workspacePreferencesRef.current;
    if (current.activeRoute === nextRoute) {
      return;
    }
    handleWorkspacePreferencesChange({
      ...current,
      activeRoute: nextRoute,
    });
  }

  const toggleLeftRail = useCallback((): void => {
    const current = workspacePreferencesRef.current;
    handleWorkspacePreferencesChange({
      ...current,
      isLeftRailVisible: !current.isLeftRailVisible,
    });
  }, [handleWorkspacePreferencesChange]);

  const toggleRightInspector = useCallback((): void => {
    const current = workspacePreferencesRef.current;
    handleWorkspacePreferencesChange({
      ...current,
      isRightInspectorVisible: !current.isRightInspectorVisible,
    });
  }, [handleWorkspacePreferencesChange]);

  // Keyboard shortcuts: mod+b toggles the left rail, mod+alt+b toggles the right
  // inspector. Anomalyco's OpenCode desktop uses the same mod+b convention
  // (reference/anomalyco-opencode-desktop-layout.md). We treat Meta (mac) and Ctrl
  // (win/linux) as interchangeable to keep one binding across platforms, and skip
  // when the user is typing inside a form field so shortcuts don't eat keystrokes.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
      }
      return target.isContentEditable;
    };

    const handler = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'b') {
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (event.shiftKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      if (event.altKey) {
        toggleRightInspector();
      } else {
        toggleLeftRail();
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [toggleLeftRail, toggleRightInspector]);

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

        // Merge saved preferences on top of current defaults so older snapshots that
        // predate newly-added keys (e.g. isLeftRailVisible) fall back cleanly instead
        // of collapsing to `undefined`. Simpler than a schema bump.
        const nextPreferences: WorkspacePreferences = {
          ...createDefaultWorkspacePreferences(),
          ...(savedLayout?.preferences ?? {}),
        };
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

  const openSettingsPane = useCallback((): void => {
    setPendingSettingsSectionId(null);
    handleActiveRouteChange('settings');
  }, [handleActiveRouteChange]);

  const openMemoryPane = useCallback((): void => {
    handleActiveRouteChange('memory');
  }, [handleActiveRouteChange]);

  const openConnectionsSection = useCallback((): void => {
    setPendingSettingsSectionId('connections');
    handleActiveRouteChange('connections');
  }, [handleActiveRouteChange]);

  const handlePendingSettingsSectionConsumed = useCallback((): void => {
    setPendingSettingsSectionId(null);
  }, []);
  const registry = useMemo<PaneRegistry<TinkerPaneData>>(() => {
    return {
      chat: {
        kind: 'chat',
        defaultTitle: 'Chat',
        render: ({ pane, tabId, isActive }) => {
          const handleSelectSessionFolder = async (): Promise<void> => {
            const folderPath = await onSelectSessionFolder();
            if (folderPath) {
              const memorySubdir = await getActiveMemoryPath(currentUserId);
              setSessionSwitcherResolved(true);
              workspaceStore.getState().actions.updatePaneData(tabId, pane.id, (prev) => ({
                ...prev,
                folderPath,
                memorySubdir,
              }));
            }
          };
          return (
            <RegisteredChatPane
              tabId={tabId}
              paneId={pane.id}
              isActive={isActive}
              paneData={requirePaneData('chat', pane.data)}
              onAttentionSignal={(reason) => signalPaneAttention(pane.id, reason)}
              onSelectSessionFolder={handleSelectSessionFolder}
              onDuplicatePane={() => workspaceStore.getState().actions.duplicatePane(tabId, pane.id)}
              onClosePane={() => workspaceStore.getState().actions.closePane(tabId, pane.id)}
            />
          );
        },
      },
      file: {
        kind: 'file',
        defaultTitle: (pane) => getPanelTitleForPath(requirePaneData('file', pane.data).path),
        render: ({ pane }) => <>{getRenderer('file')(requirePaneData('file', pane.data))}</>,
      },
    };
  }, [signalPaneAttention, onSelectSessionFolder, currentUserId, workspaceStore]);

  const chatPaneRuntime = useMemo(
    () => ({
      skillStore,
      skillsRootPath,
      currentUserId,
      modelConnected,
      opencode,
      getConnectionForPane,
      releaseConnectionForPane,
      sessionFolderPath: vaultPath,
      vaultPath,
      activeSkillsRevision,
      sessionFolderBusy,
      onSelectSessionFolder: async () => {
        await onSelectSessionFolder();
      },
      onFileWritten: handleAgentFileWritten,
      onOpenFileLink: openFileInWorkspace,
      onOpenNewChat: openNewChatPane,
      onActiveSkillsChanged,
      onMemoryCommitted,
      persistPaneSessionId: (tabId: string, paneId: string, sessionId: string) => {
        workspaceStore.getState().actions.updatePaneData(tabId, paneId, (prev) => ({
          ...prev,
          sessionId,
        }));
        void refreshStoredSessions();
      },
    }),
    [
      activeSkillsRevision,
      currentUserId,
      getConnectionForPane,
      handleAgentFileWritten,
      modelConnected,
      onActiveSkillsChanged,
      onMemoryCommitted,
      onSelectSessionFolder,
      openFileInWorkspace,
      openNewChatPane,
      opencode,
      releaseConnectionForPane,
      refreshStoredSessions,
      sessionFolderBusy,
      vaultPath,
      skillStore,
      skillsRootPath,
    ],
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
      pendingSectionId: pendingSettingsSectionId,
      onPendingSectionConsumed: handlePendingSettingsSectionConsumed,
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
    pendingSettingsSectionId,
    handlePendingSettingsSectionConsumed,
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
  const shouldShowSessionSwitcher =
    !sessionSwitcherResolved && (storedSessions.length > 0 || sessionLoadError !== null);
  const routeContent = (() => {
    switch (activeRoute) {
      case 'memory':
        return <MemoryRoute />;
      case 'settings':
        return <SettingsRoute />;
      case 'connections':
        return <ConnectionsRoute />;
      case 'workspace':
        return shouldShowSessionSwitcher ? (
          <SessionSwitcher
            sessions={storedSessions}
            busy={sessionFolderBusy}
            errorMessage={sessionLoadError}
            onSelectSession={handleSelectStoredSession}
            onCreateSession={handleCreateSessionFromSwitcher}
            onRetry={() => void refreshStoredSessions()}
          />
        ) : (
          <PanesWorkspace
            store={workspaceStore}
            registry={registry}
            attention={{
              store: attentionStore,
              workspaceId: DESKTOP_WORKSPACE_ATTENTION_ID,
            }}
            ariaLabel="Tinker workspace"
          />
        );
    }
  })();

  return (
    <WorkspaceShell
      isLeftRailVisible={workspacePreferences.isLeftRailVisible}
      isRightInspectorVisible={workspacePreferences.isRightInspectorVisible}
      titlebar={
        <Titlebar
          sessionFolderPath={vaultPath}
          currentUserName={currentUserName}
          currentUserAvatarUrl={currentUserAvatarUrl}
          isLeftRailVisible={workspacePreferences.isLeftRailVisible}
          isRightInspectorVisible={workspacePreferences.isRightInspectorVisible}
          onToggleLeftRail={toggleLeftRail}
          onToggleRightInspector={toggleRightInspector}
        />
      }
      sidebar={
        <WorkspaceSidebar
          userInitial={userInitial}
          avatarUrl={currentUserAvatarUrl}
          accountLabel={accountLabel}
          activeRailItem={resolvedActiveRailItem}
          onOpenChat={openNewChatPane}
          onOpenMemory={openMemoryPane}
          onOpenSettings={openSettingsPane}
          onOpenAccount={openSettingsPane}
          onOpenConnections={openConnectionsSection}
        />
      }
    >
      <ChatPaneRuntimeContext.Provider value={chatPaneRuntime}>
        <SettingsPaneRuntimeContext.Provider value={settingsPaneRuntime}>
          <MemoryPaneRuntimeContext.Provider value={{ currentUserId }}>
            {routeContent}
          </MemoryPaneRuntimeContext.Provider>
        </SettingsPaneRuntimeContext.Provider>
      </ChatPaneRuntimeContext.Provider>
    </WorkspaceShell>
  );
};
