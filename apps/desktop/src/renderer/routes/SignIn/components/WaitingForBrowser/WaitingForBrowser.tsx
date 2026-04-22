import { Button, StatusDot } from '@tinker/design';
import type { AuthProvider } from '../../../../../bindings.js';
import './WaitingForBrowser.css';

export type WaitingForBrowserProps = {
  readonly provider: AuthProvider;
  readonly showRetry: boolean;
  readonly onCancel: () => void;
  readonly onRetry: () => void;
};

const PROVIDER_LABEL: Record<AuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
};

export const WaitingForBrowser = ({
  provider,
  showRetry,
  onCancel,
  onRetry,
}: WaitingForBrowserProps) => {
  const providerLabel = PROVIDER_LABEL[provider];
  return (
    <section
      className="signin-waiting"
      aria-labelledby="signin-waiting-title"
      data-pending-provider={provider}
    >
      <div className="signin-waiting__status">
        <StatusDot state="pulse" label={`Waiting for ${providerLabel} sign-in`} />
      </div>

      <header className="signin-waiting__header">
        <p className="tinker-eyebrow">Waiting on browser</p>
        <h1 className="signin-waiting__title" id="signin-waiting-title">
          Continue in your browser
        </h1>
        <p className="signin-waiting__subtitle tinker-muted">
          We opened a {providerLabel} sign-in tab. Approve it there and Tinker will pick
          up the result automatically.
        </p>
      </header>

      <div className="signin-waiting__actions">
        <Button variant="secondary" size="m" onClick={onCancel}>
          Cancel
        </Button>
        {showRetry ? (
          <Button
            variant="primary"
            size="m"
            onClick={onRetry}
            data-action="reopen-browser"
          >
            Open browser again
          </Button>
        ) : null}
      </div>

      {showRetry ? (
        <p className="signin-waiting__hint tinker-muted">
          Still waiting? The browser tab may have closed. Reopen it and try again.
        </p>
      ) : null}
    </section>
  );
};
