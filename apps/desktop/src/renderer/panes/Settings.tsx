import type { JSX } from 'react';
import type { SSOSession } from '@tinker/shared-types';

type SettingsProps = {
  modelConnected: boolean;
  modelAuthBusy: boolean;
  modelAuthMessage: string | null;
  googleAuthBusy: boolean;
  googleAuthMessage: string | null;
  session: SSOSession | null;
  vaultPath: string | null;
  onConnectModel(): Promise<void>;
  onConnectGoogle(): Promise<void>;
  onDisconnectModel(): Promise<void>;
  onDisconnectGoogle(): Promise<void>;
  onCreateVault(): Promise<void>;
  onSelectVault(): Promise<void>;
};

export const Settings = ({
  modelAuthBusy,
  modelAuthMessage,
  modelConnected,
  googleAuthBusy,
  googleAuthMessage,
  onConnectModel,
  session,
  vaultPath,
  onConnectGoogle,
  onCreateVault,
  onDisconnectModel,
  onDisconnectGoogle,
  onSelectVault,
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
              : 'Not connected yet. Tinker asks OpenCode to run the provider OAuth flow instead of owning separate OpenAI token plumbing.'}
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
            {session ? `Connected as ${session.email}` : 'Not connected. You can skip this and still use Tinker as a coding workspace.'}
          </p>
          {googleAuthMessage ? <p className="tinker-muted">{googleAuthMessage}</p> : null}
          <div className="tinker-inline-actions">
            {session ? (
              <button className="tinker-button-secondary" type="button" onClick={() => void onDisconnectGoogle()} disabled={googleAuthBusy}>
                Disconnect Google
              </button>
            ) : (
              <button className="tinker-button" type="button" onClick={() => void onConnectGoogle()} disabled={googleAuthBusy}>
                Connect Google
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
    </section>
  );
};
