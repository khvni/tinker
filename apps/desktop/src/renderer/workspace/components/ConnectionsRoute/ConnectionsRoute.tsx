import { useState, type JSX } from 'react';
import { ConnectionsSection } from '../../../panes/Settings/ConnectionsSection/index.js';
import { useSettingsPaneRuntime } from '../../settings-pane-runtime.js';
import './ConnectionsRoute.css';

type ConnectionsTab = 'connected-apps' | 'mcps-tools';

export const ConnectionsRoute = (): JSX.Element => {
  const runtime = useSettingsPaneRuntime();
  const [activeTab, setActiveTab] = useState<ConnectionsTab>('mcps-tools');
  const connectedAppsActive = activeTab === 'connected-apps';
  const mcpsToolsActive = activeTab === 'mcps-tools';

  return (
    <main className="tinker-connections-route" aria-labelledby="tinker-connections-route-heading">
      <header className="tinker-connections-route__header">
        <p className="tinker-eyebrow">Workspace route</p>
        <h2 id="tinker-connections-route-heading">Connections</h2>
        <p className="tinker-muted">
          Monitor and retry the built-in MCP tools available to the active OpenCode sidecar.
        </p>
      </header>
      <div className="tinker-connections-route__tabs" role="tablist" aria-label="Connection views">
        <button
          className="tinker-connections-route__tab"
          type="button"
          role="tab"
          aria-selected={connectedAppsActive}
          onClick={() => setActiveTab('connected-apps')}
        >
          Connected Apps
        </button>
        <button
          className="tinker-connections-route__tab"
          type="button"
          role="tab"
          aria-selected={mcpsToolsActive}
          onClick={() => setActiveTab('mcps-tools')}
        >
          MCPs &amp; Tools
        </button>
      </div>
      {connectedAppsActive ? (
        <section
          className="tinker-connections-route__card"
          role="tabpanel"
          aria-label="Connected Apps"
        >
          <p className="tinker-eyebrow">Post-MVP</p>
          <h3>Connected Apps</h3>
          <p className="tinker-muted">
            OAuth app connections will appear here after connected-app providers ship.
          </p>
        </section>
      ) : (
        <section role="tabpanel" aria-label="MCPs & Tools">
          <ConnectionsSection
            opencode={runtime.opencode}
            vaultPath={runtime.vaultPath}
            memoryPath={runtime.vaultPath}
            seedStatuses={runtime.mcpSeedStatuses}
            onRequestRespawn={runtime.onRequestRespawn}
          />
        </section>
      )}
    </main>
  );
};
