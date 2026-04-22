import type { JSX } from 'react';
import { Avatar, Badge } from '@tinker/design';
import type { SSOStatus, User } from '@tinker/shared-types';
import { ProviderPicker } from '../../../../../routes/SignIn/components/ProviderPicker/index.js';
import type { AuthProvider } from '../../../../../../bindings.js';
import './AccountSection.css';

type ProviderBusyState = Record<AuthProvider, boolean>;
type ProviderMessageState = Partial<Record<AuthProvider, string | null>>;

export type AccountSectionProps = {
  readonly currentUserName: string;
  readonly currentUserProvider: User['provider'];
  readonly currentUserEmail: string | null;
  readonly currentUserAvatarUrl: string | null;
  readonly nativeRuntimeAvailable: boolean;
  readonly guestBusy: boolean;
  readonly guestMessage: string | null;
  readonly providerBusy: ProviderBusyState;
  readonly providerMessages: ProviderMessageState;
  readonly sessions: SSOStatus;
  readonly onContinueAsGuest: () => Promise<void>;
  readonly onConnectGoogle: () => Promise<void>;
  readonly onConnectGithub: () => Promise<void>;
  readonly onConnectMicrosoft: () => Promise<void>;
};

const providerToneLabel = (provider: User['provider']): string => {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    case 'microsoft':
      return 'Microsoft';
    case 'local':
      return 'Guest';
  }
};

const providerButtonLabel = (
  provider: AuthProvider,
  busy: ProviderBusyState,
  sessions: SSOStatus,
): string => {
  if (busy[provider]) {
    return 'Connecting…';
  }

  switch (provider) {
    case 'google':
      return sessions.google ? 'Reconnect Google' : 'Continue with Google';
    case 'github':
      return sessions.github ? 'Reconnect GitHub' : 'Continue with GitHub';
    case 'microsoft':
      return sessions.microsoft ? 'Reconnect Microsoft' : 'Continue with Microsoft';
  }
};

export const AccountSection = ({
  currentUserName,
  currentUserProvider,
  currentUserEmail,
  currentUserAvatarUrl,
  nativeRuntimeAvailable,
  guestBusy,
  guestMessage,
  providerBusy,
  providerMessages,
  sessions,
  onContinueAsGuest,
  onConnectGoogle,
  onConnectGithub,
  onConnectMicrosoft,
}: AccountSectionProps): JSX.Element => {
  const guestMode = currentUserProvider === 'local';

  return (
    <section className="tk-account-section" aria-labelledby="settings-account-title">
      <div className="tk-account-section__summary">
        <Avatar
          name={currentUserName}
          size="lg"
          {...(currentUserAvatarUrl ? { src: currentUserAvatarUrl } : {})}
        />
        <div className="tk-account-section__copy">
          <div className="tk-account-section__name-row">
            <h2 className="tk-account-section__name" id="settings-account-title">
              {currentUserName}
            </h2>
            <Badge variant={guestMode ? 'default' : 'success'} size="small">
              {guestMode ? 'Guest mode' : 'Signed in'}
            </Badge>
          </div>
          <p className="tk-account-section__meta tinker-muted">
            {currentUserEmail
              ? currentUserEmail
              : 'Local guest profile. Sessions and memory stay on this device.'}
          </p>
          <p className="tk-account-section__meta tinker-muted">
            Current identity: {providerToneLabel(currentUserProvider)}
          </p>
        </div>
      </div>

      <ProviderPicker
        disabled={!nativeRuntimeAvailable}
        providerBusy={providerBusy}
        providerMessages={providerMessages}
        onContinueAsGuest={() => {
          void onContinueAsGuest();
        }}
        guestBusy={guestBusy}
        guestMessage={guestMessage}
        eyebrow="Account"
        title={guestMode ? 'Sign in to Tinker' : 'Switch account'}
        subtitle="Use guest mode for local-only work, or connect a provider from Settings when you need it."
        footnote={null}
        headingLevel="h2"
        onPick={(provider) => {
          switch (provider) {
            case 'google':
              void onConnectGoogle();
              return;
            case 'github':
              void onConnectGithub();
              return;
            case 'microsoft':
              void onConnectMicrosoft();
              return;
          }
        }}
        guestLabel="Continue as guest"
      />

      <div className="tinker-list">
        <article className="tinker-list-item">
          <h3>Connected providers</h3>
          <p className="tinker-muted">
            Google, GitHub, and Microsoft sign-in stay optional. Guest mode remains available at any time.
          </p>
          <p className="tinker-muted">
            {[
              sessions.google ? providerButtonLabel('google', providerBusy, sessions) : null,
              sessions.github ? providerButtonLabel('github', providerBusy, sessions) : null,
              sessions.microsoft ? providerButtonLabel('microsoft', providerBusy, sessions) : null,
            ]
              .filter((label): label is string => label !== null)
              .join(' · ') || 'No providers connected yet.'}
          </p>
        </article>
      </div>
    </section>
  );
};
