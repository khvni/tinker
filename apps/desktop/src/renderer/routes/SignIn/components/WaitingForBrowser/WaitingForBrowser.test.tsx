import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WaitingForBrowser } from './WaitingForBrowser.js';

describe('WaitingForBrowser', () => {
  it('shows the provider name in the subtitle', () => {
    const markup = renderToStaticMarkup(
      <WaitingForBrowser
        provider="google"
        showRetry={false}
        onCancel={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(markup).toContain('Google sign-in tab');
    expect(markup).toContain('data-pending-provider="google"');
  });

  it('always renders the cancel action', () => {
    const markup = renderToStaticMarkup(
      <WaitingForBrowser
        provider="github"
        showRetry={false}
        onCancel={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(markup).toContain('Cancel');
  });

  it('does not render the reopen affordance until showRetry is true', () => {
    const markup = renderToStaticMarkup(
      <WaitingForBrowser
        provider="microsoft"
        showRetry={false}
        onCancel={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(markup).not.toContain('data-action="reopen-browser"');
    expect(markup).not.toContain('Open browser again');
  });

  it('renders the reopen affordance + hint when showRetry is true', () => {
    const markup = renderToStaticMarkup(
      <WaitingForBrowser
        provider="microsoft"
        showRetry
        onCancel={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(markup).toContain('data-action="reopen-browser"');
    expect(markup).toContain('Open browser again');
    expect(markup).toContain('Still waiting?');
  });

  it('exposes the pulsing status dot for assistive tech', () => {
    const markup = renderToStaticMarkup(
      <WaitingForBrowser
        provider="github"
        showRetry={false}
        onCancel={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(markup).toContain('aria-label="Waiting for GitHub sign-in"');
  });
});
