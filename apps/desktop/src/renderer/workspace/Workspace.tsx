import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import type { LayoutStore, MemoryStore, SSOSession } from '@tinker/shared-types';
import { DEFAULT_USER_ID } from '../../bindings.js';
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
  opencodeUrl: string;
  session: SSOSession | null;
  vaultPath: string | null;
  onConnectGoogle(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
};

export const Workspace = ({
  layoutStore,
  memoryStore,
  onConnectGoogle,
  onCreateVault,
  onDisconnectGoogle,
  onSelectVault,
  opencodeUrl,
  session,
  vaultPath,
}: WorkspaceProps): JSX.Element => {
  const dockviewApiRef = useRef<DockviewApi | null>(null);
  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const components = useMemo(
    () =>
      createPaneRegistry({
        'vault-browser': (props) => <VaultBrowser {...props} />,
        chat: () => <Chat memoryStore={memoryStore} opencodeUrl={opencodeUrl} />,
        today: () => <Today memoryStore={memoryStore} vaultPath={vaultPath} />,
        settings: () => (
          <Settings
            session={session}
            vaultPath={vaultPath}
            onConnectGoogle={onConnectGoogle}
            onDisconnectGoogle={onDisconnectGoogle}
            onCreateVault={onCreateVault}
            onSelectVault={onSelectVault}
          />
        ),
        file: (props) => <CodeRenderer {...props} />,
        markdown: (props) => <MarkdownRenderer {...props} />,
        html: (props) => <HtmlRenderer {...props} />,
        csv: (props) => <CsvRenderer {...props} />,
        image: (props) => <ImageRenderer {...props} />,
        code: (props) => <CodeRenderer {...props} />,
        'markdown-editor': (props) => <MarkdownEditor {...props} />,
      }),
    [memoryStore, onConnectGoogle, onCreateVault, onDisconnectGoogle, onSelectVault, opencodeUrl, session, vaultPath],
  );

  const onReady = (event: DockviewReadyEvent): void => {
    dockviewApiRef.current = event.api;
    setDockviewApi(event.api);

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
    })();
  };

  useEffect(() => {
    const api = dockviewApiRef.current;
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
      position: {
        referencePanel: 'chat',
        direction: 'left',
      },
    });
  }, [memoryStore, vaultPath]);

  return (
    <main className="tinker-workspace-shell">
      <header className="tinker-header">
        <div>
          <p className="tinker-eyebrow">Workspace</p>
          <h1>Tinker</h1>
        </div>
        <div className="tinker-header-meta">
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
