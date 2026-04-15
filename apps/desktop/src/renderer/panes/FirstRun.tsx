import type { JSX } from 'react';
import type { SSOStatus } from '@tinker/shared-types';
import type { MCPStatus } from '../components/IntegrationsStrip.js';
import { IntegrationsStrip } from '../components/IntegrationsStrip.js';

type FirstRunProps = {
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
  onSelectVault(): Promise<void>;
  onCreateVault(): Promise<void>;
  onContinue(): void;
};

export const FirstRun = ({
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
          Connect GPT-5.4 if you want chat live on first boot. Google and GitHub are optional. Skip them and Tinker
          still works as a local coding agent.
        </p>

        <div className="tinker-first-run-grid">
          <article className="tinker-list-item">
            <h3>1. GPT-5.4 sign-in</h3>
            <p className="tinker-muted">
              {modelConnected
                ? 'Connected through OpenCode.'
                : 'Optional on first launch. Tinker asks OpenCode to run provider auth instead of duplicating OpenAI OAuth.'}
            </p>
            {modelAuthMessage ? <p className="tinker-muted">{modelAuthMessage}</p> : null}
            <div className="tinker-inline-actions">
              <button className="tinker-button" type="button" onClick={() => void onConnectModel()} disabled={modelAuthBusy}>
                {modelConnected ? 'Reconnect GPT-5.4' : modelAuthBusy ? 'Connecting…' : 'Connect GPT-5.4'}
              </button>
            </div>
          </article>

          <article className="tinker-list-item">
            <h3>2. Connected tools</h3>
            <p className="tinker-muted">
              Google unlocks Gmail, Calendar, Drive. GitHub unlocks repos, issues, and PRs. Both stay optional.
            </p>
            <div className="tinker-inline-actions">
              <button className="tinker-button-secondary" type="button" onClick={() => void onConnectGoogle()} disabled={googleAuthBusy}>
                {googleAuthBusy ? 'Signing in…' : sessions.google ? 'Reconnect Google' : 'Sign in with Google'}
              </button>
              <button className="tinker-button-secondary" type="button" onClick={() => void onConnectGithub()} disabled={githubAuthBusy}>
                {githubAuthBusy ? 'Signing in…' : sessions.github ? 'Reconnect GitHub' : 'Sign in with GitHub'}
              </button>
            </div>
            {googleAuthMessage ? <p className="tinker-muted">{googleAuthMessage}</p> : null}
            {githubAuthMessage ? <p className="tinker-muted">{githubAuthMessage}</p> : null}
          </article>

          <article className="tinker-list-item">
            <h3>3. Pick a vault</h3>
            <p className="tinker-muted">{vaultPath ?? 'Choose existing vault or create new local knowledge base.'}</p>
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

        <div className="tinker-actions" style={{ marginTop: '1.5rem' }}>
          <button className="tinker-button" type="button" onClick={onContinue}>
            Open workspace
          </button>
        </div>
      </section>
    </main>
  );
};
