import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignIn } from './SignIn.js';

describe('SignIn (idle state)', () => {
  it('renders the provider picker by default', () => {
    const markup = renderToStaticMarkup(
      <SignIn
        nativeRuntimeAvailable
        providerMessages={{}}
        onSignIn={async () => {}}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).toContain('Sign in to Tinker');
    expect(markup).toContain('Continue as guest');
    expect(markup).toContain('data-provider="google"');
    expect(markup).toContain('data-state="idle"');
  });

  it('disables providers when the native runtime is unavailable', () => {
    const markup = renderToStaticMarkup(
      <SignIn
        nativeRuntimeAvailable={false}
        providerMessages={{}}
        onSignIn={async () => {}}
        onContinueAsGuest={() => {}}
      />,
    );
    const disabledCount = markup.match(/disabled=""/g)?.length ?? 0;
    expect(disabledCount).toBeGreaterThanOrEqual(4);
  });

  it('does not render the waiting view in the initial render', () => {
    const markup = renderToStaticMarkup(
      <SignIn
        nativeRuntimeAvailable
        providerMessages={{}}
        onSignIn={async () => {}}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).not.toContain('data-pending-provider');
    expect(markup).not.toContain('Continue in your browser');
  });

  it('forwards providerMessages into the picker as error annotations', () => {
    const markup = renderToStaticMarkup(
      <SignIn
        nativeRuntimeAvailable
        providerMessages={{ google: 'Could not reach Google.' }}
        onSignIn={async () => {}}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).toContain('data-provider-error="google"');
    expect(markup).toContain('Could not reach Google.');
  });
});
