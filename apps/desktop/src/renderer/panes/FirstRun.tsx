import type { JSX } from 'react';
import { Button } from '@tinker/design';
import type { SSOStatus } from '@tinker/shared-types';
import type { MCPStatus } from '../integrations.js';
import { IntegrationsStrip } from '../components/IntegrationsStrip.js';

type FirstRunProps = {
  nativeRuntimeAvailable?: boolean;
  runtimeNotice?: string | null;
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
  onSelectVault(): Promise<void>;
  onCreateVault(): Promise<void>;
  onContinue(): void;
};

export const FirstRun = ({
  nativeRuntimeAvailable = true,
  runtimeNotice = null,
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
  onContinue,
  onCreateVault,
  onSelectVault,
  sessions,
  vaultPath,
}: FirstRunProps): JSX.Element => {
  return (
    <main className="tinker-first-run">
      <section className="tinker-card">
        <p className="tinker-eyebrow">First run</p>
        <h1>Tinker is ready to set up your local workspace</h1>
        <p className="tinker-muted">
          Connect an AI model if you want chat live on first boot. Signing in with Google, GitHub, or Microsoft is
          optional. Skip them and Tinker still works as a local coding agent.
        </p>
        {runtimeNotice ? <p className="tinker-muted">{runtimeNotice}</p> : null}

        <div className="tinker-first-run-grid">
          <article className="tinker-list-item">
            <h3>1. AI model sign-in</h3>
            <p className="tinker-muted">
              {modelConnected
                ? 'Connected through OpenCode.'
                : 'Optional on first launch. OpenCode owns provider/model auth — Tinker hands off to it instead of running its own.'}
            </p>
            {modelAuthMessage ? <p className="tinker-muted">{modelAuthMessage}</p> : null}
            <div className="tinker-inline-actions">
              <Button
                variant="primary"
                onClick={() => void onConnectModel()}
                disabled={!nativeRuntimeAvailable || modelAuthBusy}
              >
                {modelConnected ? 'Reconnect model' : modelAuthBusy ? 'Connecting…' : 'Connect model'}
              </Button>
            </div>
          </article>

          <article className="tinker-list-item">
            <h3>2. Connected tools</h3>
            <p className="tinker-muted">
              Google unlocks Gmail, Calendar, Drive. GitHub unlocks repos, issues, and PRs. Microsoft signs Tinker in
              with a personal account. All stay optional.
            </p>
            <div className="tinker-inline-actions">
              <Button
                variant="secondary"
                onClick={() => void onConnectGoogle()}
                disabled={!nativeRuntimeAvailable || googleAuthBusy}
              >
                {googleAuthBusy ? 'Signing in…' : sessions.google ? 'Reconnect Google' : 'Sign in with Google'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void onConnectGithub()}
                disabled={!nativeRuntimeAvailable || githubAuthBusy}
              >
                {githubAuthBusy ? 'Signing in…' : sessions.github ? 'Reconnect GitHub' : 'Sign in with GitHub'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void onConnectMicrosoft()}
                disabled={!nativeRuntimeAvailable || microsoftAuthBusy}
              >
                {microsoftAuthBusy ? 'Signing in…' : sessions.microsoft ? 'Reconnect Microsoft' : 'Sign in with Microsoft'}
              </Button>
            </div>
            {googleAuthMessage ? <p className="tinker-muted">{googleAuthMessage}</p> : null}
            {githubAuthMessage ? <p className="tinker-muted">{githubAuthMessage}</p> : null}
            {microsoftAuthMessage ? <p className="tinker-muted">{microsoftAuthMessage}</p> : null}
          </article>

          <article className="tinker-list-item">
            <h3>3. Pick a vault</h3>
            <p className="tinker-muted">{vaultPath ?? 'Choose existing vault or create new local knowledge base.'}</p>
            <div className="tinker-inline-actions">
              <Button variant="secondary" onClick={() => void onSelectVault()} disabled={!nativeRuntimeAvailable}>
                Select existing vault
              </Button>
              <Button variant="ghost" onClick={() => void onCreateVault()} disabled={!nativeRuntimeAvailable}>
                Create default vault
              </Button>
            </div>
          </article>
        </div>

        <IntegrationsStrip mcpStatus={mcpStatus} sessions={sessions} />

        <div className="tinker-actions" style={{ marginTop: 'var(--space-6)' }}>
          <Button variant="primary" onClick={onContinue} disabled={!nativeRuntimeAvailable}>
            Open workspace
          </Button>
        </div>
      </section>
    </main>
  );
};
