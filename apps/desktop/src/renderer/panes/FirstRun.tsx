import type { JSX } from 'react';
import type { SSOSession } from '@tinker/shared-types';

type FirstRunProps = {
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  session: SSOSession | null;
  vaultPath: string | null;
  onConnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
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
  onConnectModel,
  onConnectGoogle,
  onContinue,
  onCreateVault,
  onSelectVault,
  session,
  vaultPath,
}: FirstRunProps): JSX.Element => {
  return (
    <main className="tinker-first-run">
      <section className="tinker-card">
        <p className="tinker-eyebrow">First run</p>
        <h1>Tinker is ready to set up your local workspace</h1>
        <p className="tinker-muted">
          Connect Google if you want integrations, choose a vault, and move straight into the workspace. You can
          skip the network pieces and still use Tinker as a coding agent.
        </p>

        <div className="tinker-first-run-grid">
          <article className="tinker-list-item">
            <h3>1. GPT-5.4 sign-in</h3>
            <p className="tinker-muted">
              {modelConnected
                ? 'Connected through OpenCode.'
                : 'Connect GPT-5.4 first if you want the chat pane live on first launch. Tinker uses OpenCode’s provider auth instead of duplicating the OpenAI OAuth flow.'}
            </p>
            {modelAuthMessage ? <p className="tinker-muted">{modelAuthMessage}</p> : null}
            <div className="tinker-inline-actions">
              <button className="tinker-button" type="button" onClick={() => void onConnectModel()} disabled={modelAuthBusy}>
                {modelConnected ? 'Reconnect GPT-5.4' : modelAuthBusy ? 'Connecting…' : 'Connect GPT-5.4'}
              </button>
            </div>
          </article>

          <article className="tinker-list-item">
            <h3>2. Google sign-in</h3>
            <p className="tinker-muted">
              {session ? `Connected as ${session.email}` : 'Optional. Enables Gmail, Calendar, Drive, and forwarded auth for MCP tools.'}
            </p>
            {googleAuthMessage ? <p className="tinker-muted">{googleAuthMessage}</p> : null}
            <div className="tinker-inline-actions">
              <button className="tinker-button-secondary" type="button" onClick={() => void onConnectGoogle()} disabled={googleAuthBusy}>
                {googleAuthBusy ? 'Connecting…' : session ? 'Reconnect Google' : 'Connect Google'}
              </button>
            </div>
          </article>

          <article className="tinker-list-item">
            <h3>3. Pick a vault</h3>
            <p className="tinker-muted">{vaultPath ?? 'Choose an existing Obsidian vault or create a new local knowledge base.'}</p>
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

        <div className="tinker-actions" style={{ marginTop: '1.5rem' }}>
          <button className="tinker-button" type="button" onClick={onContinue}>
            Open workspace
          </button>
        </div>
      </section>
    </main>
  );
};
