// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Account, type AccountUser } from './Account.js';

const GOOGLE_USER: AccountUser = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  avatarUrl: 'https://example.com/ada.png',
  provider: 'google',
};

describe('<Account>', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders name, email, provider, and avatar image when signed in', () => {
    const markup = renderToStaticMarkup(
      <Account user={GOOGLE_USER} onSignOut={vi.fn()} />,
    );

    expect(markup).toContain('Ada Lovelace');
    expect(markup).toContain('ada@example.com');
    expect(markup).toContain('Google');
    expect(markup).toContain('src="https://example.com/ada.png"');
    expect(markup).toContain('Sign out');
  });

  it('falls back to initials avatar when avatarUrl is missing', () => {
    const markup = renderToStaticMarkup(
      <Account
        user={{ displayName: 'Grace Hopper', provider: 'github' }}
        onSignOut={vi.fn()}
      />,
    );

    expect(markup).toContain('Grace Hopper');
    expect(markup).toContain('GitHub');
    expect(markup).not.toContain('<img');
  });

  it('invokes onSignOut when the button is clicked', () => {
    const handler = vi.fn();

    act(() => {
      root.render(<Account user={GOOGLE_USER} onSignOut={handler} />);
    });

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    act(() => {
      button?.click();
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('disables the button and swaps the label while signing out', () => {
    act(() => {
      root.render(<Account user={GOOGLE_USER} onSignOut={vi.fn()} busy />);
    });

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe('Signing out…');
  });

  it('renders the status message when provided', () => {
    const markup = renderToStaticMarkup(
      <Account
        user={GOOGLE_USER}
        onSignOut={vi.fn()}
        message="Signed out from Google."
      />,
    );

    expect(markup).toContain('Signed out from Google.');
    expect(markup).toContain('role="status"');
  });

  it('renders an empty state when no user is signed in', () => {
    const markup = renderToStaticMarkup(
      <Account user={null} onSignOut={vi.fn()} />,
    );

    expect(markup).toContain('Not signed in');
    expect(markup).not.toContain('Sign out');
  });
});
