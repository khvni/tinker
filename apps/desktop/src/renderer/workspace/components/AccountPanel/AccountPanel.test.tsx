// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { SSOSession } from '@tinker/shared-types';
import { AccountPanel } from './AccountPanel.js';

const baseSession: SSOSession = {
  provider: 'github',
  userId: 'user-42',
  email: 'grace@example.com',
  displayName: 'Grace Hopper',
  accessToken: '',
  refreshToken: '',
  expiresAt: new Date().toISOString(),
  scopes: [],
};

describe('AccountPanel', () => {
  it('renders the signed-out state when session is null', () => {
    const markup = renderToStaticMarkup(
      <AccountPanel session={null} signOutBusy={false} signOutMessage={null} onSignOut={vi.fn()} />,
    );

    expect(markup).toContain('Not signed in');
  });

  it('renders identity + provider + sign-out button when signed in', () => {
    const markup = renderToStaticMarkup(
      <AccountPanel
        session={baseSession}
        signOutBusy={false}
        signOutMessage={null}
        onSignOut={vi.fn()}
      />,
    );

    expect(markup).toContain('Grace Hopper');
    expect(markup).toContain('grace@example.com');
    expect(markup).toContain('GitHub');
    expect(markup).toContain('Sign out');
  });

  it('renders avatar src when provided', () => {
    const markup = renderToStaticMarkup(
      <AccountPanel
        session={{ ...baseSession, avatarUrl: 'https://example.com/a.png' }}
        signOutBusy={false}
        signOutMessage={null}
        onSignOut={vi.fn()}
      />,
    );

    expect(markup).toContain('https://example.com/a.png');
  });

  it('renders the busy label and disables the button while signing out', () => {
    const markup = renderToStaticMarkup(
      <AccountPanel
        session={baseSession}
        signOutBusy
        signOutMessage={null}
        onSignOut={vi.fn()}
      />,
    );

    expect(markup).toContain('Signing out…');
    expect(markup).toContain('disabled');
  });

  it('renders the notice line when a sign-out message is present', () => {
    const markup = renderToStaticMarkup(
      <AccountPanel
        session={baseSession}
        signOutBusy={false}
        signOutMessage="GitHub disconnected."
        onSignOut={vi.fn()}
      />,
    );

    expect(markup).toContain('GitHub disconnected.');
  });

  it('invokes onSignOut with the active session when the button is clicked', async () => {
    const onSignOut = vi.fn(async () => {});
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AccountPanel
          session={baseSession}
          signOutBusy={false}
          signOutMessage={null}
          onSignOut={onSignOut}
        />,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('.tk-account-panel__actions button');
    expect(button).not.toBeNull();
    await act(async () => {
      button?.click();
    });

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledWith(baseSession);

    await act(async () => {
      root.unmount();
    });
  });
});
