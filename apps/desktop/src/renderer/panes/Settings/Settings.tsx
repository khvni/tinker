import type { JSX } from 'react';
import { Button, Toggle } from '@tinker/design';
import type { SSOStatus, WorkspacePreferences } from '@tinker/shared-types';
import type { MCPStatus } from '../../integrations.js';
import { IntegrationsStrip } from '../../components/IntegrationsStrip.js';
import { useMemoryRootControls } from './useMemoryRootControls.js';
import './Settings.css';

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
  workspacePreferences: WorkspacePreferences;
  onWorkspacePreferencesChange(nextPreferences: WorkspacePreferences): void;
};

const getProgressPercent = (copiedFiles: number, totalFiles: number): number => {
  if (totalFiles === 0) {
    return 100;
  }

  return Math.min(100, Math.round((copiedFiles / totalFiles) * 100));
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
  workspacePreferences,
  onWorkspacePreferencesChange,
}: SettingsProps): JSX.Element => {
  const { changeMemoryRoot, memoryRoot, memoryRootBusy, moveProgress, notice } = useMemoryRootControls();
  const progressPercent = moveProgress ? getProgressPercent(moveProgress.copiedFiles, moveProgress.totalFiles) : 0;

  return (
    <section className="tinker-pane tinker-settings">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Settings</p>
          <h2>Connections and storage</h2>
        </div>
      </header>

      {notice ? (
        <div
          className={`tinker-settings__notice tinker-settings__notice--${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <p>{notice.message}</p>
        </div>
      ) : null}

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
          <div className="tinker-settings__memory-row">
            <div className="tinker-settings__memory-copy">
              <h3>Memory folder</h3>
              <p className="tinker-muted">
                Desktop-global markdown memory lives here. Tinker creates one subfolder per signed-in user under this root.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void changeMemoryRoot()} disabled={memoryRootBusy}>
              {memoryRootBusy ? 'Moving…' : 'Change location…'}
            </Button>
          </div>
          <div className="tinker-settings__path-shell">
            <p className="tinker-settings__path-label">Current root</p>
            <p className="tinker-settings__path-value" title={memoryRoot ?? 'Resolving memory folder…'}>
              {memoryRoot ?? 'Resolving memory folder…'}
            </p>
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

      {moveProgress ? (
        <div className="tinker-settings__move-backdrop">
          <section className="tinker-settings__move-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-move-title">
            <p className="tinker-eyebrow">Moving memory</p>
            <h3 id="memory-move-title">Updating memory folder</h3>
            <p className="tinker-muted">
              {moveProgress.totalFiles === 0
                ? 'Preparing the new memory location.'
                : `Moved ${moveProgress.copiedFiles} of ${moveProgress.totalFiles} files.`}
            </p>
            <div
              className="tinker-settings__progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={moveProgress.totalFiles === 0 ? 100 : moveProgress.totalFiles}
              aria-valuenow={moveProgress.totalFiles === 0 ? progressPercent : moveProgress.copiedFiles}
            >
              <div className="tinker-settings__progress-value" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="tinker-settings__move-meta">{progressPercent}% complete</p>
            {moveProgress.currentPath ? (
              <p className="tinker-settings__move-current">Current file: {moveProgress.currentPath}</p>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
};
