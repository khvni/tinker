import type { JSX } from 'react';
import type { SSOStatus } from '@tinker/shared-types';
import type { MCPStatus } from '../components/IntegrationsStrip.js';
import { IntegrationsStrip } from '../components/IntegrationsStrip.js';

type SettingsProps = {
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  githubAuthBusy: boolean;
  githubAuthMessage: string | null;
  sessions: SSOStatus;
  mcpStatus: Record<string, MCPStatus>;
  vaultPath: string | null;
  onConnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onConnectGithub(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onDisconnectGithub(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
};

export const Settings = ({
  modelAuthBusy,
  modelAuthMessage,
  modelConnected,
  googleAuthBusy,
  googleAuthMessage,
  githubAuthBusy,
  githubAuthMessage,
  mcpStatus,
  onConnectGithub,
  onConnectGoogle,
  onConnectModel,
  onCreateVault,
  onDisconnectGithub,
  onDisconnectGoogle,
  onDisconnectModel,
  onSelectVault,
  sessions,
  vaultPath,
}: SettingsProps): JSX.Element => {
  return (
    <section className="tinker-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Settings</p>
          <h2>Connections and storage</h2>
        </div>
      </header>

      <div className="tinker-list">
        <article className="tinker-list-item">
          <h3>GPT-5.4</h3>
          <p className="tinker-muted">
            {modelConnected
              ? 'Connected through OpenCode.'
              : 'Not connected yet. Tinker asks OpenCode to run provider auth instead of owning separate OpenAI token plumbing.'}
          </p>
          {modelAuthMessage ? <p className="tinker-muted">{modelAuthMessage}</p> : null}
          <div className="tinker-inline-actions">
            {modelConnected ? (
              <button className="tinker-button-secondary" type="button" onClick={() => void onDisconnectModel()} disabled={modelAuthBusy}>
                Disconnect GPT-5.4
              </button>
            ) : (
              <button className="tinker-button" type="button" onClick={() => void onConnectModel()} disabled={modelAuthBusy}>
                {modelAuthBusy ? 'Connecting…' : 'Connect GPT-5.4'}
              </button>
            )}
          </div>
        </article>

        <article className="tinker-list-item">
          <h3>Google</h3>
          <p className="tinker-muted">
            {sessions.google ? `Connected as ${sessions.google.email}` : 'Optional. Enables Gmail, Calendar, and Drive.'}
          </p>
          {googleAuthMessage ? <p className="tinker-muted">{googleAuthMessage}</p> : null}
          <div className="tinker-inline-actions">
            {sessions.google ? (
              <button className="tinker-button-secondary" type="button" onClick={() => void onDisconnectGoogle()} disabled={googleAuthBusy}>
                Disconnect Google
              </button>
            ) : (
              <button className="tinker-button" type="button" onClick={() => void onConnectGoogle()} disabled={googleAuthBusy}>
                {googleAuthBusy ? 'Signing in…' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </article>

        <article className="tinker-list-item">
          <h3>GitHub</h3>
          <p className="tinker-muted">
            {sessions.github ? `Connected as ${sessions.github.email}` : 'Optional. Enables GitHub repos, issues, and pull requests.'}
          </p>
          {githubAuthMessage ? <p className="tinker-muted">{githubAuthMessage}</p> : null}
          <div className="tinker-inline-actions">
            {sessions.github ? (
              <button className="tinker-button-secondary" type="button" onClick={() => void onDisconnectGithub()} disabled={githubAuthBusy}>
                Disconnect GitHub
              </button>
            ) : (
              <button className="tinker-button" type="button" onClick={() => void onConnectGithub()} disabled={githubAuthBusy}>
                {githubAuthBusy ? 'Signing in…' : 'Sign in with GitHub'}
              </button>
            )}
          </div>
        </article>

        <article className="tinker-list-item">
          <h3>Vault</h3>
          <p className="tinker-muted">{vaultPath ?? 'No vault selected yet.'}</p>
          <div className="tinker-inline-actions">
            <button className="tinker-button-secondary" type="button" onClick={() => void onSelectVault()}>
              Select existing vault
            </button>
            <button className="tinker-button-ghost" type="button" onClick={() => void onCreateVault()}>
              Create default vault
            </button>
          </div>
        </article>
      </div>

      <IntegrationsStrip mcpStatus={mcpStatus} sessions={sessions} />
    </section>
  );
};
