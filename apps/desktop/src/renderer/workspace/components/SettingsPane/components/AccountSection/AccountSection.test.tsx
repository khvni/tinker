import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountSection } from './AccountSection.js';

describe('AccountSection', () => {
  it('renders guest summary and the shared sign-in controls', () => {
    const markup = renderToStaticMarkup(
      <AccountSection
        currentUserName="Guest"
        currentUserProvider="local"
        currentUserEmail={null}
        currentUserAvatarUrl={null}
        nativeRuntimeAvailable
        guestBusy={false}
        guestMessage={null}
        providerBusy={{ google: false, github: false, microsoft: false }}
        providerMessages={{ google: null, github: null, microsoft: null }}
        sessions={{ google: null, github: null, microsoft: null }}
        onContinueAsGuest={async () => {}}
        onConnectGoogle={async () => {}}
        onConnectGithub={async () => {}}
        onConnectMicrosoft={async () => {}}
      />,
    );

    expect(markup).toContain('Guest mode');
    expect(markup).toContain('Continue as guest');
    expect(markup).toContain('Continue with Google');
  });

  it('shows reconnect copy for an already connected provider', () => {
    const markup = renderToStaticMarkup(
      <AccountSection
        currentUserName="Ada Lovelace"
        currentUserProvider="github"
        currentUserEmail="ada@example.com"
        currentUserAvatarUrl={null}
        nativeRuntimeAvailable
        guestBusy={false}
        guestMessage={null}
        providerBusy={{ google: false, github: false, microsoft: false }}
        providerMessages={{ google: null, github: null, microsoft: null }}
        sessions={{
          google: null,
          github: {
            provider: 'github',
            userId: 'ada',
            email: 'ada@example.com',
            displayName: 'Ada Lovelace',
            accessToken: 'token',
            refreshToken: 'refresh',
            expiresAt: '2026-04-22T00:00:00.000Z',
            scopes: [],
          },
          microsoft: null,
        }}
        onContinueAsGuest={async () => {}}
        onConnectGoogle={async () => {}}
        onConnectGithub={async () => {}}
        onConnectMicrosoft={async () => {}}
      />,
    );

    expect(markup).toContain('Signed in');
    expect(markup).toContain('Reconnect GitHub');
    expect(markup).toContain('ada@example.com');
  });
});
