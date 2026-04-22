import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Badge, Button } from '@tinker/design';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import { resolveVaultPath, type MemoryRunState } from '@tinker/memory';
import {
  createDefaultWorkspacePreferences,
  type LayoutState,
  type LayoutStore,
  type MemoryStore,
  type ScheduledJobStore,
  type SkillStore,
  type SSOStatus,
  type WorkspacePreferences,
} from '@tinker/shared-types';
import { DEFAULT_USER_ID, type OpencodeConnection } from '../../bindings.js';
import { IntegrationsStrip } from '../components/IntegrationsStrip.js';
import type { MCPStatus } from '../integrations.js';
import { Chat } from '../panes/Chat.js';
import { Playbook } from '../panes/Playbook.js';
import { SchedulerPane } from '../panes/SchedulerPane.js';
import { Settings } from '../panes/Settings.js';
import { Today } from '../panes/Today.js';
import { VaultBrowser } from '../panes/VaultBrowser.js';
import { CodeRenderer } from '../renderers/CodeRenderer.js';
import { CsvRenderer } from '../renderers/CsvRenderer.js';
import { HtmlRenderer } from '../renderers/HtmlRenderer.js';
import { ImageRenderer } from '../renderers/ImageRenderer.js';
import { MarkdownEditor } from '../renderers/MarkdownEditor.js';
import { MarkdownRenderer } from '../renderers/MarkdownRenderer.js';
import { isAbsolutePath } from '../renderers/file-utils.js';
import { ChatPaneRuntimeContext } from './chat-pane-runtime.js';
import { DockviewApiContext } from './DockviewContext.js';
import { openNewChatPanel } from './chat-panels.js';
import { openWorkspaceFile } from './file-open.js';
import { applyDefaultLayout } from './layout.default.js';
import { createPaneRegistry } from './pane-registry.js';

const LAYOUT_SAVE_DEBOUNCE_MS = 300;
const LAYOUT_VERSION = 1 as const;

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

export const Workspace = ({
  layoutStore,
  memoryStore,
  schedulerStore,
  schedulerRevision,
  skillStore,
  modelAuthBusy,
  modelAuthMessage,
  modelConnected,
  googleAuthBusy,
  googleAuthMessage,
  githubAuthBusy,
  githubAuthMessage,
  onConnectModel,
  onConnectGithub,
  onConnectGoogle,
  onCreateVault,
  onDisconnectGithub,
  onDisconnectModel,
  onDisconnectGoogle,
  onSelectVault,
  onActiveSkillsChanged,
  onRunScheduledJobNow,
  onSchedulerChanged,
  onRunMemorySweep,
  onMemoryCommitted,
  mcpStatus,
  opencode,
  sessions,
  vaultPath,
  vaultRevision,
  activeSkillsRevision,
  memorySweepState,
  memorySweepBusy,
}: WorkspaceProps): JSX.Element => {
  const dockviewApiRef = useRef<DockviewApi | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const vaultPathRef = useRef<string | null>(vaultPath);
  const workspacePreferencesRef = useRef<WorkspacePreferences>(createDefaultWorkspacePreferences());
  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const [workspacePreferences, setWorkspacePreferences] = useState<WorkspacePreferences>(createDefaultWorkspacePreferences);

  useEffect(() => {
    vaultPathRef.current = vaultPath;
  }, [vaultPath]);

  useEffect(() => {
    workspacePreferencesRef.current = workspacePreferences;
  }, [workspacePreferences]);

  const getReferencePanelId = (api: DockviewApi): string | null => {
    return api.activePanel?.id ?? api.panels[0]?.id ?? null;
  };

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
      const api = dockviewApiRef.current;
      if (!api) {
        return;
      }

      const absolutePath = resolveAgentPath(reportedPath);
      if (!absolutePath) {
        return;
      }

      openWorkspaceFile(api, absolutePath);
    },
    [resolveAgentPath],
  );

  const openNewChatPane = useCallback((): void => {
    const api = dockviewApiRef.current;
    if (!api) {
      return;
    }

    openNewChatPanel(api);
  }, []);

  const handleAgentFileWritten = useCallback(
    (reportedPath: string): void => {
      if (!workspacePreferencesRef.current.autoOpenAgentWrittenFiles) {
        return;
      }

      openFileInWorkspace(reportedPath);
    },
    [openFileInWorkspace],
  );

  const saveLayoutNow = useCallback(
    (api: DockviewApi): void => {
      const snapshot: LayoutState = {
        version: LAYOUT_VERSION,
        dockviewModel: api.toJSON(),
        updatedAt: new Date().toISOString(),
        preferences: workspacePreferencesRef.current,
      };

      void layoutStore.save(DEFAULT_USER_ID, snapshot).catch((error) => {
        console.warn('Failed to persist workspace layout.', error);
      });
    },
    [layoutStore],
  );

  const scheduleLayoutSave = useCallback(
    (api: DockviewApi): void => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        saveLayoutNow(api);
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [saveLayoutNow],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;

        const api = dockviewApiRef.current;
        if (api) {
          saveLayoutNow(api);
        }
      }
    };
  }, [saveLayoutNow]);

  const handleWorkspacePreferencesChange = useCallback(
    (nextPreferences: WorkspacePreferences): void => {
      workspacePreferencesRef.current = nextPreferences;
      setWorkspacePreferences(nextPreferences);

      const api = dockviewApiRef.current;
      if (api) {
        saveLayoutNow(api);
      }
    },
    [saveLayoutNow],
  );

  const openOrFocusPane = (
    id: 'scheduler' | 'settings' | 'today',
    title: string,
  ): void => {
    const api = dockviewApiRef.current;
    if (!api) {
      return;
    }

    const existingPanel = api.panels.find((panel) => panel.id === id);
    if (existingPanel) {
      existingPanel.api.setActive();
      return;
    }

    const referencePanelId = getReferencePanelId(api);
    api.addPanel({
      id,
      component: id,
      title,
      ...(referencePanelId
        ? {
            position: {
              referencePanel: referencePanelId,
              direction: 'within' as const,
            },
          }
        : {}),
    });
  };

  const openSchedulerPane = (): void => openOrFocusPane('scheduler', 'Scheduler');
  const openSettingsPane = (): void => openOrFocusPane('settings', 'Settings');
  const openTodayPane = (): void => openOrFocusPane('today', 'Today');

  const components = useMemo(
    () =>
      createPaneRegistry({
        'vault-browser': (props) => <VaultBrowser {...props} vaultRevision={vaultRevision} />,
        chat: () => (
          <Chat
            skillStore={skillStore}
            modelConnected={modelConnected}
            opencode={opencode}
            vaultPath={vaultPath}
            activeSkillsRevision={activeSkillsRevision}
            onFileWritten={handleAgentFileWritten}
            onOpenNewChat={openNewChatPane}
            onMemoryCommitted={onMemoryCommitted}
          />
        ),
        today: () => (
          <Today
            memoryStore={memoryStore}
            schedulerStore={schedulerStore}
            vaultPath={vaultPath}
            vaultRevision={vaultRevision}
            schedulerRevision={schedulerRevision}
            memorySweepState={memorySweepState}
            memorySweepBusy={memorySweepBusy}
            onRunMemorySweep={onRunMemorySweep}
          />
        ),
        scheduler: () => (
          <SchedulerPane
            schedulerStore={schedulerStore}
            schedulerRevision={schedulerRevision}
            vaultPath={vaultPath}
            onRunJobNow={onRunScheduledJobNow}
            onSchedulerChanged={onSchedulerChanged}
          />
        ),
        settings: () => (
          <Settings
            modelConnected={modelConnected}
            modelAuthBusy={modelAuthBusy}
            modelAuthMessage={modelAuthMessage}
            googleAuthBusy={googleAuthBusy}
            googleAuthMessage={googleAuthMessage}
            githubAuthBusy={githubAuthBusy}
            githubAuthMessage={githubAuthMessage}
            sessions={sessions}
            mcpStatus={mcpStatus}
            vaultPath={vaultPath}
            onConnectModel={onConnectModel}
            onConnectGoogle={onConnectGoogle}
            onConnectGithub={onConnectGithub}
            onDisconnectModel={onDisconnectModel}
            onDisconnectGoogle={onDisconnectGoogle}
            onDisconnectGithub={onDisconnectGithub}
            onCreateVault={onCreateVault}
            onSelectVault={onSelectVault}
            workspacePreferences={workspacePreferences}
            onWorkspacePreferencesChange={handleWorkspacePreferencesChange}
          />
        ),
        playbook: (props) => <Playbook {...props} />,
        file: (props) => <CodeRenderer {...props} />,
        markdown: (props) => <MarkdownRenderer {...props} vaultRevision={vaultRevision} />,
        html: (props) => <HtmlRenderer {...props} />,
        csv: (props) => <CsvRenderer {...props} />,
        image: (props) => <ImageRenderer {...props} />,
        code: (props) => <CodeRenderer {...props} />,
        'markdown-editor': (props) => <MarkdownEditor {...props} vaultRevision={vaultRevision} />,
      }),
    [
      activeSkillsRevision,
      memoryStore,
      skillStore,
      modelAuthBusy,
      modelAuthMessage,
      modelConnected,
      memorySweepBusy,
      memorySweepState,
      googleAuthBusy,
      googleAuthMessage,
      githubAuthBusy,
      githubAuthMessage,
      onConnectGoogle,
      onConnectGithub,
      onConnectModel,
      onCreateVault,
      onDisconnectGoogle,
      onDisconnectGithub,
      onDisconnectModel,
      onMemoryCommitted,
      onRunMemorySweep,
      onRunScheduledJobNow,
      onSchedulerChanged,
      onSelectVault,
      opencode,
      sessions,
      mcpStatus,
      vaultPath,
      vaultRevision,
      schedulerStore,
      schedulerRevision,
      handleAgentFileWritten,
      openNewChatPane,
      handleWorkspacePreferencesChange,
      workspacePreferences,
    ],
  );

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

  const onReady = (event: DockviewReadyEvent): void => {
    dockviewApiRef.current = event.api;

    void (async () => {
      let savedLayout: LayoutState | null = null;
      try {
        savedLayout = await layoutStore.load(DEFAULT_USER_ID);
      } catch (error) {
        console.warn('Failed to load saved workspace layout. Falling back to default.', error);
      }

      let hydrated = false;
      const nextPreferences = savedLayout?.preferences ?? createDefaultWorkspacePreferences();
      workspacePreferencesRef.current = nextPreferences;
      setWorkspacePreferences(nextPreferences);

      if (savedLayout?.dockviewModel) {
        try {
          event.api.fromJSON(savedLayout.dockviewModel as ReturnType<typeof event.api.toJSON>);
          hydrated = event.api.panels.length > 0;
        } catch (error) {
          console.warn('Stored workspace layout could not be hydrated. Falling back to default.', error);
          hydrated = false;
        }
      }

      if (!hydrated) {
        event.api.clear();
        applyDefaultLayout(event.api, {
          memoryStore,
          skillStore,
          vaultPath,
        });
      }

      event.api.panels
        .filter((panel) => panel.id === 'vault-browser')
        .forEach((panel) => {
          panel.api.updateParameters({
            memoryStore,
            vaultPath,
          });
        });

      event.api.panels
        .filter((panel) => panel.id === 'playbook')
        .forEach((panel) => {
          panel.api.updateParameters({
            skillStore,
            vaultPath,
            onActiveSkillsChanged,
          });
        });

      event.api.onDidLayoutChange(() => {
        scheduleLayoutSave(event.api);
      });

      setDockviewApi(event.api);
      scheduleLayoutSave(event.api);
    })();
  };

  useEffect(() => {
    const api = dockviewApi;
    if (!api) {
      return;
    }

    // Push fresh params into open panels that depend on vault / stores.
    api.panels
      .filter((panel) => panel.id === 'vault-browser')
      .forEach((panel) => {
        panel.api.updateParameters({ memoryStore, vaultPath });
      });

    api.panels
      .filter((panel) => panel.id === 'playbook')
      .forEach((panel) => {
        panel.api.updateParameters({ skillStore, vaultPath, onActiveSkillsChanged });
      });

    // When a vault gets connected after boot, surface the vault browser.
    if (vaultPath && !api.panels.some((panel) => panel.id === 'vault-browser')) {
      const referencePanelId = getReferencePanelId(api);
      api.addPanel({
        id: 'vault-browser',
        component: 'vault-browser',
        title: 'Vault',
        params: { memoryStore, vaultPath },
        initialWidth: 280,
        inactive: true,
        ...(referencePanelId
          ? {
              position: {
                referencePanel: referencePanelId,
                direction: 'left' as const,
              },
            }
          : {}),
      });
    }
  }, [dockviewApi, memoryStore, onActiveSkillsChanged, skillStore, vaultPath]);

  return (
    <main className="tinker-workspace-shell">
      <header className="tinker-header">
        <div>
          <p className="tinker-eyebrow">Workspace</p>
          <h1>Tinker</h1>
        </div>
        <div className="tinker-inline-actions">
          <Button variant="secondary" size="s" onClick={openNewChatPane} disabled={!dockviewApi}>
            New chat
          </Button>
          <Button variant="secondary" size="s" onClick={openTodayPane} disabled={!dockviewApi}>
            Today
          </Button>
          <Button variant="secondary" size="s" onClick={openSchedulerPane} disabled={!dockviewApi}>
            Scheduler
          </Button>
          <Button variant="secondary" size="s" onClick={openSettingsPane} disabled={!dockviewApi}>
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
        <DockviewApiContext.Provider value={dockviewApi}>
          <DockviewReact
            className="dockview-theme-abyss tinker-dockview"
            components={components}
            onReady={onReady}
          />
        </DockviewApiContext.Provider>
      </ChatPaneRuntimeContext.Provider>
    </main>
  );
};
