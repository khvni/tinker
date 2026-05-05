import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Layout, Model, Actions, DockLocation, type TabNode, type Action, type IJsonModel } from 'flexlayout-react';
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
import { getPanelTitleForPath, isAbsolutePath } from '../renderers/file-utils.js';
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
import { createDefaultLayoutJson } from './layout.default.js';
import { MemoryPaneRuntimeContext } from './memory-pane-runtime.js';
import { getRenderer } from './pane-registry.js';
import { PlaybookPaneRuntimeContext, type PlaybookPaneRuntime } from './playbook-pane-runtime.js';
import {
  SettingsPaneRuntimeContext,
  pickActiveSession,
  type SettingsPaneRuntime,
} from './settings-pane-runtime.js';

const LAYOUT_SAVE_DEBOUNCE_MS = 300;

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
  homeDirPath: string | null;
  activeSkillsRevision: number;
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

const requirePaneData = <K extends TinkerPaneKind>(
  kind: K,
  data: TinkerPaneData,
): Extract<TinkerPaneData, { readonly kind: K }> => {
  if (data.kind !== kind) {
    throw new Error(`Pane kind mismatch: expected "${kind}" but received "${data.kind}".`);
  }

  return data as Extract<TinkerPaneData, { readonly kind: K }>;
};

type WorkspaceRoute = 'chat' | 'memory' | 'connections' | 'settings';

const toPersistedRoute = (route: WorkspaceRoute): WorkspacePreferences['activeRoute'] =>
  route === 'chat' ? 'workspace' : route;

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
  homeDirPath,
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
  const modelRef = useRef<Model | null>(null);
  if (!modelRef.current) {
    modelRef.current = Model.fromJson(createDefaultLayoutJson());
  }
  const model = modelRef.current;

  const saveTimerRef = useRef<number | null>(null);
  const vaultPathRef = useRef<string | null>(vaultPath);
  const workspacePreferencesRef = useRef<WorkspacePreferences>(createDefaultWorkspacePreferences());
  const [workspacePreferences, setWorkspacePreferences] = useState<WorkspacePreferences>(
    createDefaultWorkspacePreferences(),
  );
  const [pendingSettingsSectionId, setPendingSettingsSectionId] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>('chat');
  const activeRouteRef = useRef<WorkspaceRoute>('chat');
  const [storedSessions, setStoredSessions] = useState<Session[]>([]);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [sessionSwitcherResolved, setSessionSwitcherResolved] = useState(false);

  useEffect(() => {
    vaultPathRef.current = vaultPath;
  }, [vaultPath]);

  useEffect(() => {
    workspacePreferencesRef.current = workspacePreferences;
  }, [workspacePreferences]);

  useEffect(() => {
    activeRouteRef.current = activeRoute;
  }, [activeRoute]);

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
      setSessionSwitcherResolved(true);
      const absolutePath = resolveAgentPath(reportedPath);
      if (!absolutePath) {
        return;
      }

      if (options?.mime) {
        void openWorkspaceFile(model, absolutePath, async () => options.mime ?? 'application/octet-stream');
        return;
      }

      void openWorkspaceFile(model, absolutePath);
    },
    [resolveAgentPath, model],
  );

  const openNewChatPane = useCallback((): void => {
    setSessionSwitcherResolved(true);
    openNewChatPanel(model);
  }, [model]);

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
      const title = getPanelTitleForPath(session.folderPath.replace(/[\\/]+$/u, ''));
      let activeTabset = model.getActiveTabset();
      const firstTabset = model.getFirstTabSet();

      if (!activeTabset && !firstTabset) {
        console.warn('Cannot open a session chat panel because the workspace has no tabsets.');
        return;
      }

      let existingNodeId: string | null = null;
      model.visitNodes((node) => {
        if (existingNodeId || node.getType() !== 'tab') return;
        const tabNode = node as TabNode;
        const config = tabNode.getConfig() as TinkerPaneData | undefined;
        if (config?.kind === 'chat' && config.sessionId === session.id) {
          existingNodeId = tabNode.getId();
        }
      });

      if (existingNodeId) {
        model.doAction(Actions.selectTab(existingNodeId));
        return;
      }

      const selectedNode = activeTabset?.getSelectedNode();
      if (selectedNode?.getType() === 'tab') {
        const selectedTab = selectedNode as TabNode;
        const config = selectedTab.getConfig() as TinkerPaneData | undefined;
        if (config?.kind === 'chat' && !config.sessionId && !config.folderPath) {
          model.doAction(
            Actions.updateNodeAttributes(selectedTab.getId(), {
              name: title,
              config: {
                kind: 'chat',
                sessionId: session.id,
                folderPath: session.folderPath,
                memorySubdir,
              },
            }),
          );
          return;
        }
      }

      activeTabset = activeTabset ?? firstTabset;
      model.doAction(
        Actions.addTab(
          {
            type: 'tab',
            id: `chat-${session.id}`,
            name: title,
            component: 'chat',
            config: {
              kind: 'chat' as const,
              sessionId: session.id,
              folderPath: session.folderPath,
              memorySubdir,
            },
          },
          activeTabset.getId(),
          DockLocation.CENTER,
          -1,
          true,
        ),
      );
    },
    [currentUserId, model],
  );

  const handleCreateSessionFromSwitcher = useCallback((): void => {
    void (async () => {
      const folderPath = await onSelectSessionFolder();
      if (!folderPath) {
        return;
      }

      const memorySubdir = await getActiveMemoryPath(currentUserId);
      const title = getPanelTitleForPath(folderPath.replace(/[\\/]+$/u, ''));
      const targetId = model.getActiveTabset()?.getId() ?? model.getFirstTabSet().getId();
      model.doAction(
        Actions.addTab(
          {
            type: 'tab',
            id: `chat-${crypto.randomUUID()}`,
            name: title,
            component: 'chat',
            config: { kind: 'chat' as const, createFreshSession: true, folderPath, memorySubdir },
          },
          targetId,
          DockLocation.CENTER,
          -1,
          true,
        ),
      );

      setSessionSwitcherResolved(true);
      await refreshStoredSessions();
    })();
  }, [currentUserId, model, onSelectSessionFolder, refreshStoredSessions]);

  const handleSelectStoredSession = useCallback(
    (session: Session): void => {
      void (async () => {
        await onActivateSession(session);
        await openSessionChatPane(session);
        setSessionSwitcherResolved(true);
        await refreshStoredSessions();
      })();
    },
    [onActivateSession, openSessionChatPane, refreshStoredSessions],
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
    const currentModel = modelRef.current;
    if (!currentModel) return;
    const layoutJson = currentModel.toJson();

    void layoutStore
      .save(currentUserId, {
        version: 3,
        layoutJson,
        updatedAt: new Date().toISOString(),
        preferences: {
          ...workspacePreferencesRef.current,
          activeRoute: toPersistedRoute(activeRouteRef.current),
        },
      })
      .catch((error) => {
        console.warn('Failed to persist workspace layout.', error);
      });
  }, [currentUserId, layoutStore]);

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

    void (async () => {
      try {
        const savedLayout = await layoutStore.load(currentUserId);
        if (!active) {
          return;
        }

        const nextPreferences: WorkspacePreferences = {
          ...createDefaultWorkspacePreferences(),
          ...(savedLayout?.preferences ?? {}),
        };
        const hydratedRoute = nextPreferences.activeRoute === 'workspace' ? 'chat' : nextPreferences.activeRoute;
        activeRouteRef.current = hydratedRoute;
        setActiveRoute(hydratedRoute);
        workspacePreferencesRef.current = nextPreferences;
        setWorkspacePreferences(nextPreferences);

        if (savedLayout?.layoutJson) {
          try {
            const restoredModel = Model.fromJson(savedLayout.layoutJson as IJsonModel);
            modelRef.current = restoredModel;
          } catch (error) {
            console.warn('Stored workspace layout could not be hydrated. Falling back to default.', error);
            modelRef.current = Model.fromJson(createDefaultLayoutJson());
          }
        }
      } catch (error) {
        console.warn('Failed to load saved workspace layout. Falling back to default.', error);
      }

      scheduleLayoutSave();
    })();

    return () => {
      active = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      saveLayoutNow();
    };
  }, [currentUserId, layoutStore, saveLayoutNow, scheduleLayoutSave]);

  const navigateTo = useCallback(
    (route: WorkspaceRoute): void => {
      activeRouteRef.current = route;
      setActiveRoute(route);
      const current = workspacePreferencesRef.current;
      handleWorkspacePreferencesChange({ ...current, activeRoute: toPersistedRoute(route) });
    },
    [handleWorkspacePreferencesChange],
  );

  const openChatRoute = useCallback((): void => {
    navigateTo('chat');
  }, [navigateTo]);

  const openSettingsPane = useCallback((): void => {
    navigateTo('settings');
  }, [navigateTo]);

  const openMemoryPane = useCallback((): void => {
    navigateTo('memory');
  }, [navigateTo]);

  const openConnectionsSection = useCallback((): void => {
    setPendingSettingsSectionId(null);
    navigateTo('connections');
  }, [navigateTo]);

  const handlePendingSettingsSectionConsumed = useCallback((): void => {
    setPendingSettingsSectionId(null);
  }, []);

  const handleModelChange = useCallback((_model: Model, _action: Action): void => {
    scheduleLayoutSave();
  }, [scheduleLayoutSave]);

  const factory = useCallback(
    (node: TabNode): JSX.Element | null => {
      const component = node.getComponent();
      const config = (node.getConfig() ?? { kind: component }) as TinkerPaneData;
      const tabId = node.getParent()?.getId() ?? '';
      const paneId = node.getId();
      const isActive = node.isSelected();

      switch (component) {
        case 'chat': {
          const handleSelectSessionFolder = async (): Promise<void> => {
            const folderPath = await onSelectSessionFolder();
            if (folderPath) {
              const memorySubdir = await getActiveMemoryPath(currentUserId);
              const currentConfig = (node.getConfig() ?? { kind: 'chat' }) as TinkerPaneData;
              setSessionSwitcherResolved(true);
              model.doAction(
                Actions.updateNodeAttributes(paneId, {
                  config: { ...currentConfig, folderPath, memorySubdir },
                }),
              );
            }
          };
          return (
            <RegisteredChatPane
              tabId={tabId}
              paneId={paneId}
              isActive={isActive}
              paneData={requirePaneData('chat', config)}
              onAttentionSignal={() => { /* FlexLayout manages focus */ }}
              onSelectSessionFolder={handleSelectSessionFolder}
              onDuplicatePane={() => {
                const activeTabset = model.getActiveTabset();
                if (activeTabset) {
                  const liveConfig = (node.getConfig() ?? { kind: 'chat' }) as TinkerPaneData;
                  model.doAction(
                    Actions.addTab(
                      {
                        type: 'tab',
                        name: node.getName(),
                        component: 'chat',
                        config: { ...liveConfig },
                      },
                      activeTabset.getId(),
                      DockLocation.CENTER,
                      -1,
                      true,
                    ),
                  );
                }
              }}
              onClosePane={() => model.doAction(Actions.deleteTab(paneId))}
            />
          );
        }
        case 'file':
          return <>{getRenderer('file')(requirePaneData('file', config))}</>;
        default:
          return <div>Unknown pane: {component}</div>;
      }
    },
    [currentUserId, model, onSelectSessionFolder],
  );

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
      persistPaneSessionId: (_tabId: string, paneId: string, sessionId: string) => {
        const node = model.getNodeById(paneId);
        if (node?.getType() !== 'tab') {
          return;
        }
        const config = ((node as TabNode).getConfig() ?? { kind: 'chat' }) as TinkerPaneData;
        model.doAction(
          Actions.updateNodeAttributes(paneId, {
            config: { ...config, sessionId },
          }),
        );
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
      refreshStoredSessions,
      model,
      releaseConnectionForPane,
      sessionFolderBusy,
      vaultPath,
      skillStore,
      skillsRootPath,
    ],
  );

  const playbookPaneRuntime = useMemo<PlaybookPaneRuntime>(
    () => ({
      skillStore,
      skillsRootPath,
      onActiveSkillsChanged,
    }),
    [onActiveSkillsChanged, skillStore, skillsRootPath],
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
      memoryPath: skillsRootPath,
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
    skillsRootPath,
    mcpStatus,
    onRequestMcpRespawn,
  ]);

  const userInitial = (currentUserId.trim()[0] ?? 'T').toUpperCase();
  const shouldShowSessionSwitcher =
    !sessionSwitcherResolved && (storedSessions.length > 0 || sessionLoadError !== null);
  const chatRouteContent = shouldShowSessionSwitcher ? (
    <SessionSwitcher
      sessions={storedSessions}
      busy={sessionFolderBusy}
      errorMessage={sessionLoadError}
      onSelectSession={handleSelectStoredSession}
      onCreateSession={handleCreateSessionFromSwitcher}
      onRetry={() => void refreshStoredSessions()}
    />
  ) : (
    <Layout
      model={model}
      factory={factory}
      onModelChange={handleModelChange}
    />
  );
  const workspaceContent = (() => {
    switch (activeRoute) {
      case 'memory':
        return <MemoryRoute />;
      case 'connections':
        return <ConnectionsRoute />;
      case 'settings':
        return <SettingsRoute />;
      case 'chat':
        return chatRouteContent;
    }
  })();
  const isGuest = currentUserProvider === 'local';
  const accountLabel = isGuest
    ? 'Account · Guest'
    : `Account · ${currentUserEmail ?? currentUserName}`;

  return (
    <WorkspaceShell
      isLeftRailVisible={workspacePreferences.isLeftRailVisible}
      isRightInspectorVisible={workspacePreferences.isRightInspectorVisible}
      titlebar={
        <Titlebar
          sessionFolderPath={vaultPath}
          homeDirPath={homeDirPath}
          isLeftRailVisible={workspacePreferences.isLeftRailVisible}
          currentUserName={isGuest ? 'Guest' : currentUserName}
          currentUserAvatarUrl={currentUserAvatarUrl}
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
          activeRailItem={activeRoute === 'chat' ? 'chat' : activeRoute}
          onOpenChat={openChatRoute}
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
            <PlaybookPaneRuntimeContext.Provider value={playbookPaneRuntime}>
              {workspaceContent}
            </PlaybookPaneRuntimeContext.Provider>
          </MemoryPaneRuntimeContext.Provider>
        </SettingsPaneRuntimeContext.Provider>
      </ChatPaneRuntimeContext.Provider>
    </WorkspaceShell>
  );
};
