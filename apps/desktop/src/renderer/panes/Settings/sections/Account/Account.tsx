import type { JSX } from 'react';
import { Avatar, Button } from '@tinker/design';
import type { SSOProvider } from '@tinker/shared-types';
import './Account.css';

const PROVIDER_LABEL: Record<SSOProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
};

export type AccountUser = {
  readonly displayName: string;
  readonly email?: string;
  readonly avatarUrl?: string;
  readonly provider: SSOProvider;
};

export type AccountProps = {
  readonly user: AccountUser | null;
  readonly onSignOut: () => Promise<void> | void;
  readonly busy?: boolean;
  readonly message?: string | null;
};

export const Account = ({
  user,
  onSignOut,
  busy = false,
  message,
}: AccountProps): JSX.Element => {
  if (!user) {
    return (
      <div className="tk-account">
        <header className="tk-account__header">
          <p className="tk-account__eyebrow">Account</p>
          <h2 className="tk-account__title">Not signed in</h2>
          <p className="tk-account__lede">
            Sign in from the welcome screen to link a provider to this machine.
          </p>
        </header>
      </div>
    );
  }

  const providerLabel = PROVIDER_LABEL[user.provider];

  return (
    <div className="tk-account">
      <header className="tk-account__header">
        <p className="tk-account__eyebrow">Account</p>
        <h2 className="tk-account__title">Signed in</h2>
        <p className="tk-account__lede">
          Sign out to clear the refresh token from the OS keychain and return to the sign-in screen.
        </p>
      </header>

      <section className="tk-account__card" aria-label="Current user">
        <Avatar
          size="lg"
          name={user.displayName}
          {...(user.avatarUrl ? { src: user.avatarUrl } : {})}
        />
        <div className="tk-account__identity">
          <p className="tk-account__name">{user.displayName}</p>
          {user.email ? <p className="tk-account__email">{user.email}</p> : null}
          <p className="tk-account__provider">
            <span className="tk-account__provider-label">Provider</span>
            <span className="tk-account__provider-value">{providerLabel}</span>
          </p>
        </div>
      </section>

      <div className="tk-account__actions">
        <Button variant="secondary" onClick={() => void onSignOut()} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
        {message ? (
          <p className="tk-account__message" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
};
