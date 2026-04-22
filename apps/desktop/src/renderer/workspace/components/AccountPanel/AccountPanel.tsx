import type { JSX } from 'react';
import { Avatar, Button } from '@tinker/design';
import type { SSOSession } from '@tinker/shared-types';
import './AccountPanel.css';

export type AccountPanelProps = {
  readonly session: SSOSession | null;
  readonly signOutBusy: boolean;
  readonly signOutMessage: string | null;
  onSignOut(session: SSOSession): Promise<void> | void;
};

const providerLabel = (provider: SSOSession['provider']): string => {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    case 'microsoft':
      return 'Microsoft';
  }
};

export const AccountPanel = ({
  session,
  signOutBusy,
  signOutMessage,
  onSignOut,
}: AccountPanelProps): JSX.Element => {
  if (!session) {
    return (
      <section className="tk-account-panel" aria-label="Account">
        <header className="tk-account-panel__header">
          <p className="tk-account-panel__eyebrow">Account</p>
          <h2 className="tk-account-panel__title">Not signed in</h2>
          <p className="tk-account-panel__lede">
            Sign in with Google, GitHub, or Microsoft to scope sessions, memory, and chat history
            to your user.
          </p>
        </header>
      </section>
    );
  }

  const avatarProps = session.avatarUrl
    ? { name: session.displayName, src: session.avatarUrl }
    : { name: session.displayName };

  return (
    <section className="tk-account-panel" aria-label="Account">
      <header className="tk-account-panel__header">
        <p className="tk-account-panel__eyebrow">Account</p>
        <h2 className="tk-account-panel__title">Signed in</h2>
        <p className="tk-account-panel__lede">
          Sessions, memory, and chat history are scoped to this user. Signing out clears the
          keychain refresh token and returns to the sign-in screen.
        </p>
      </header>

      <article className="tk-account-panel__card">
        <Avatar {...avatarProps} size="lg" />
        <div className="tk-account-panel__identity">
          <p className="tk-account-panel__name">{session.displayName}</p>
          <p className="tk-account-panel__email">{session.email}</p>
          <p className="tk-account-panel__provider">
            <span className="tk-account-panel__provider-label">Provider</span>
            <span className="tk-account-panel__provider-value">{providerLabel(session.provider)}</span>
          </p>
        </div>
      </article>

      {signOutMessage ? (
        <p className="tk-account-panel__notice" role="status" aria-live="polite">
          {signOutMessage}
        </p>
      ) : null}

      <div className="tk-account-panel__actions">
        <Button
          variant="secondary"
          onClick={() => {
            void onSignOut(session);
          }}
          disabled={signOutBusy}
        >
          {signOutBusy ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </section>
  );
};
