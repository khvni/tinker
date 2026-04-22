import type { JSX } from 'react';
import { Button, Toggle } from '@tinker/design';
import type { SSOStatus } from '@tinker/shared-types';
import type { MCPStatus } from '../integrations.js';
import { IntegrationsStrip } from '../components/IntegrationsStrip.js';
import type { WorkspacePreferences } from '@tinker/shared-types';

type SettingsProps = {
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  githubAuthBusy: boolean;
  githubAuthMessage: string | null;
  microsoftAuthBusy: boolean;
  microsoftAuthMessage: string | null;
  sessions: SSOStatus;
  mcpStatus: Record<string, MCPStatus>;
  vaultPath: string | null;
  onConnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onConnectGithub(): Promise<void>;
  onConnectMicrosoft(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onDisconnectGithub(): Promise<void>;
  onDisconnectMicrosoft(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
  workspacePreferences: WorkspacePreferences;
  onWorkspacePreferencesChange(nextPreferences: WorkspacePreferences): void;
};

export const Settings = ({
  modelAuthBusy,
  modelAuthMessage,
  modelConnected,
  googleAuthBusy,
  googleAuthMessage,
  githubAuthBusy,
  githubAuthMessage,
  microsoftAuthBusy,
  microsoftAuthMessage,
  mcpStatus,
  onConnectGithub,
  onConnectGoogle,
  onConnectMicrosoft,
  onConnectModel,
  onCreateVault,
  onDisconnectGithub,
  onDisconnectGoogle,
  onDisconnectMicrosoft,
  onDisconnectModel,
  onSelectVault,
  sessions,
  vaultPath,
  workspacePreferences,
  onWorkspacePreferencesChange,
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
          <h3>AI model</h3>
          <p className="tinker-muted">
            {modelConnected
              ? 'Connected through OpenCode.'
              : 'Not connected yet. OpenCode owns provider/model auth — Tinker hands off to it instead of owning its own token plumbing.'}
          </p>
          {modelAuthMessage ? <p className="tinker-muted">{modelAuthMessage}</p> : null}
          <div className="tinker-inline-actions">
            {modelConnected ? (
              <Button variant="secondary" onClick={() => void onDisconnectModel()} disabled={modelAuthBusy}>
                Disconnect model
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void onConnectModel()} disabled={modelAuthBusy}>
                {modelAuthBusy ? 'Connecting…' : 'Connect model'}
              </Button>
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
              <Button variant="secondary" onClick={() => void onDisconnectGoogle()} disabled={googleAuthBusy}>
                Disconnect Google
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void onConnectGoogle()} disabled={googleAuthBusy}>
                {googleAuthBusy ? 'Signing in…' : 'Sign in with Google'}
              </Button>
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
              <Button variant="secondary" onClick={() => void onDisconnectGithub()} disabled={githubAuthBusy}>
                Disconnect GitHub
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void onConnectGithub()} disabled={githubAuthBusy}>
                {githubAuthBusy ? 'Signing in…' : 'Sign in with GitHub'}
              </Button>
            )}
          </div>
        </article>

        <article className="tinker-list-item">
          <h3>Microsoft</h3>
          <p className="tinker-muted">
            {sessions.microsoft
              ? `Connected as ${sessions.microsoft.email}`
              : 'Optional. Signs Tinker in with a personal Microsoft account.'}
          </p>
          {microsoftAuthMessage ? <p className="tinker-muted">{microsoftAuthMessage}</p> : null}
          <div className="tinker-inline-actions">
            {sessions.microsoft ? (
              <Button variant="secondary" onClick={() => void onDisconnectMicrosoft()} disabled={microsoftAuthBusy}>
                Disconnect Microsoft
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void onConnectMicrosoft()} disabled={microsoftAuthBusy}>
                {microsoftAuthBusy ? 'Signing in…' : 'Sign in with Microsoft'}
              </Button>
            )}
          </div>
        </article>

        <article className="tinker-list-item">
          <h3>Vault</h3>
          <p className="tinker-muted">{vaultPath ?? 'No vault selected yet.'}</p>
          <div className="tinker-inline-actions">
            <Button variant="secondary" onClick={() => void onSelectVault()}>
              Select existing vault
            </Button>
            <Button variant="ghost" onClick={() => void onCreateVault()}>
              Create default vault
            </Button>
          </div>
        </article>

        <article className="tinker-list-item">
          <h3>Workspace</h3>
          <p className="tinker-muted">Agent-written files open automatically by default. Turn it off if you want manual review first.</p>
          <div className="tinker-inline-actions" style={{ gap: 'var(--space-3)' }}>
            <Toggle
              checked={workspacePreferences.autoOpenAgentWrittenFiles}
              onChange={(next) =>
                onWorkspacePreferencesChange({
                  autoOpenAgentWrittenFiles: next,
                })
              }
              label="Auto-open agent-written files"
            />
            <span className="tinker-muted">
              Auto-open agent-written files: {workspacePreferences.autoOpenAgentWrittenFiles ? 'On' : 'Off'}
            </span>
          </div>
        </article>
      </div>

      <IntegrationsStrip mcpStatus={mcpStatus} sessions={sessions} />
    </section>
  );
};
