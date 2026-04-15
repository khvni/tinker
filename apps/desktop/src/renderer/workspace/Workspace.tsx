import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import type { LayoutStore, MemoryStore, SSOSession } from '@tinker/shared-types';
import { DEFAULT_USER_ID, type OpencodeConnection } from '../../bindings.js';
import { Chat } from '../panes/Chat.js';
import { Settings } from '../panes/Settings.js';
import { Today } from '../panes/Today.js';
import { VaultBrowser } from '../panes/VaultBrowser.js';
import { CodeRenderer } from '../renderers/CodeRenderer.js';
import { CsvRenderer } from '../renderers/CsvRenderer.js';
import { HtmlRenderer } from '../renderers/HtmlRenderer.js';
import { ImageRenderer } from '../renderers/ImageRenderer.js';
import { MarkdownEditor } from '../renderers/MarkdownEditor.js';
import { MarkdownRenderer } from '../renderers/MarkdownRenderer.js';
import { applyDefaultLayout } from './layout.default.js';
import { createPaneRegistry } from './pane-registry.js';
import { DockviewApiContext } from './DockviewContext.js';

type WorkspaceProps = {
  layoutStore: LayoutStore;
  memoryStore: MemoryStore;
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  opencode: OpencodeConnection;
  session: SSOSession | null;
  vaultPath: string | null;
  vaultRevision: number;
  onConnectModel(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
};

export const Workspace = ({
  layoutStore,
  memoryStore,
  modelAuthBusy,
  modelAuthMessage,
  modelConnected,
  googleAuthBusy,
  googleAuthMessage,
  onConnectModel,
  onConnectGoogle,
  onCreateVault,
  onDisconnectModel,
  onDisconnectGoogle,
  onSelectVault,
  opencode,
  session,
  vaultPath,
  vaultRevision,
}: WorkspaceProps): JSX.Element => {
  const dockviewApiRef = useRef<DockviewApi | null>(null);
  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const getReferencePanelId = (api: DockviewApi): string | null => {
    return api.activePanel?.id ?? api.panels[0]?.id ?? null;
  };
  const components = useMemo(
    () =>
      createPaneRegistry({
        'vault-browser': (props) => <VaultBrowser {...props} vaultRevision={vaultRevision} />,
        chat: () => <Chat memoryStore={memoryStore} modelConnected={modelConnected} opencode={opencode} vaultPath={vaultPath} />,
        today: () => <Today memoryStore={memoryStore} vaultPath={vaultPath} vaultRevision={vaultRevision} />,
        settings: () => (
          <Settings
            modelConnected={modelConnected}
            modelAuthBusy={modelAuthBusy}
            modelAuthMessage={modelAuthMessage}
            googleAuthBusy={googleAuthBusy}
            googleAuthMessage={googleAuthMessage}
            session={session}
            vaultPath={vaultPath}
            onConnectModel={onConnectModel}
            onConnectGoogle={onConnectGoogle}
            onDisconnectModel={onDisconnectModel}
            onDisconnectGoogle={onDisconnectGoogle}
            onCreateVault={onCreateVault}
            onSelectVault={onSelectVault}
          />
        ),
        file: (props) => <CodeRenderer {...props} />,
        markdown: (props) => <MarkdownRenderer {...props} vaultRevision={vaultRevision} />,
        html: (props) => <HtmlRenderer {...props} />,
        csv: (props) => <CsvRenderer {...props} />,
        image: (props) => <ImageRenderer {...props} />,
        code: (props) => <CodeRenderer {...props} />,
        'markdown-editor': (props) => <MarkdownEditor {...props} vaultRevision={vaultRevision} />,
      }),
    [
      memoryStore,
      modelAuthBusy,
      modelAuthMessage,
      modelConnected,
      googleAuthBusy,
      googleAuthMessage,
      onConnectGoogle,
      onConnectModel,
      onCreateVault,
      onDisconnectGoogle,
      onDisconnectModel,
      onSelectVault,
      opencode,
      session,
      vaultPath,
      vaultRevision,
    ],
  );

  const onReady = (event: DockviewReadyEvent): void => {
    dockviewApiRef.current = event.api;

    void (async () => {
      const savedLayout = await layoutStore.load(DEFAULT_USER_ID);

      if (savedLayout?.dockviewModel) {
        event.api.fromJSON(savedLayout.dockviewModel as ReturnType<typeof event.api.toJSON>);
      } else {
        applyDefaultLayout(event.api, {
          memoryStore,
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

      event.api.onDidLayoutChange(() => {
        void layoutStore.save(DEFAULT_USER_ID, {
          version: 1,
          dockviewModel: event.api.toJSON(),
          updatedAt: new Date().toISOString(),
        });
      });

      setDockviewApi(event.api);
    })();
  };

  useEffect(() => {
    const api = dockviewApi;
    if (!api) {
      return;
    }

    api.panels
      .filter((panel) => panel.id === 'vault-browser')
      .forEach((panel) => {
        panel.api.updateParameters({
          memoryStore,
          vaultPath,
        });
      });

    if (!vaultPath || api.panels.some((panel) => panel.id === 'vault-browser')) {
      return;
    }

    const referencePanelId = getReferencePanelId(api);
    api.addPanel({
      id: 'vault-browser',
      component: 'vault-browser',
      title: 'Vault',
      params: {
        memoryStore,
        vaultPath,
      },
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
  }, [dockviewApi, memoryStore, vaultPath]);

  return (
    <main className="tinker-workspace-shell">
      <header className="tinker-header">
        <div>
          <p className="tinker-eyebrow">Workspace</p>
          <h1>Tinker</h1>
        </div>
        <div className="tinker-header-meta">
          <span className="tinker-pill">{modelConnected ? 'GPT-5.4 connected' : 'GPT-5.4 disconnected'}</span>
          <span className="tinker-pill">{session ? session.email : 'Offline mode'}</span>
          <span className="tinker-pill">{vaultPath ?? 'No vault selected'}</span>
        </div>
      </header>

      <DockviewApiContext.Provider value={dockviewApi}>
        <DockviewReact className="dockview-theme-abyss tinker-dockview" components={components} onReady={onReady} />
      </DockviewApiContext.Provider>
    </main>
  );
};
