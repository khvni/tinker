import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProviderPicker } from './ProviderPicker.js';

describe('ProviderPicker', () => {
  it('renders the title and subtitle', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled={false}
        providerMessages={{}}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).toContain('Sign in to Tinker');
    expect(markup).toContain('Pick a provider');
  });

  it('renders a button per provider with data-provider hooks', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled={false}
        providerMessages={{}}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).toContain('data-guest-action="true"');
    expect(markup).toContain('data-provider="google"');
    expect(markup).toContain('data-provider="github"');
    expect(markup).toContain('data-provider="microsoft"');
    expect(markup).toContain('Continue as guest');
    expect(markup).toContain('Continue with Google');
    expect(markup).toContain('Continue with GitHub');
    expect(markup).toContain('Continue with Microsoft');
  });

  it('disables every provider button when disabled is true', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled
        providerMessages={{}}
        onContinueAsGuest={() => {}}
      />,
    );
    const disabledCount = markup.match(/disabled=""/g)?.length ?? 0;
    expect(disabledCount).toBeGreaterThanOrEqual(4);
  });

  it('annotates a provider with its message', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled={false}
        providerMessages={{ github: 'Browser did not return a code' }}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).toContain('data-provider-error="github"');
    expect(markup).toContain('Browser did not return a code');
  });

  it('does not render an error node for providers without messages', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled={false}
        providerMessages={{ github: 'failed' }}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).not.toContain('data-provider-error="google"');
    expect(markup).not.toContain('data-provider-error="microsoft"');
  });

  it('treats null entries in providerMessages as no message', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled={false}
        providerMessages={{ google: null, github: 'failed', microsoft: null }}
        onContinueAsGuest={() => {}}
      />,
    );
    expect(markup).not.toContain('data-provider-error="google"');
    expect(markup).toContain('data-provider-error="github"');
    expect(markup).not.toContain('data-provider-error="microsoft"');
  });

  it('renders a guest error annotation when guest mode hits a failure', () => {
    const markup = renderToStaticMarkup(
      <ProviderPicker
        onPick={() => {}}
        disabled={false}
        providerMessages={{}}
        onContinueAsGuest={() => {}}
        guestMessage="Could not switch accounts."
      />,
    );

    expect(markup).toContain('data-guest-error="true"');
    expect(markup).toContain('Could not switch accounts.');
  });
});
