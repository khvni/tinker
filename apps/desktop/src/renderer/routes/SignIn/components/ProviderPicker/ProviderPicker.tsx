import { Button } from '@tinker/design';
import type { AuthProvider } from '../../../../../bindings.js';
import './ProviderPicker.css';

export type ProviderPickerProps = {
  readonly onPick: (provider: AuthProvider) => void;
  readonly disabled: boolean;
  readonly providerMessages: Partial<Record<AuthProvider, string | null>>;
};

type ProviderEntry = {
  readonly provider: AuthProvider;
  readonly label: string;
};

const PROVIDERS: readonly ProviderEntry[] = [
  { provider: 'google', label: 'Continue with Google' },
  { provider: 'github', label: 'Continue with GitHub' },
  { provider: 'microsoft', label: 'Continue with Microsoft' },
];

export const ProviderPicker = ({
  onPick,
  disabled,
  providerMessages,
}: ProviderPickerProps) => (
  <section className="signin-picker" aria-labelledby="signin-picker-title">
    <header className="signin-picker__header">
      <p className="tinker-eyebrow">Welcome</p>
      <h1 className="signin-picker__title" id="signin-picker-title">
        Sign in to Tinker
      </h1>
      <p className="signin-picker__subtitle tinker-muted">
        Pick a provider — we'll redirect you to it in your browser. Your tokens stay on this device.
      </p>
    </header>

    <ul className="signin-picker__list">
      {PROVIDERS.map((entry) => {
        const message = providerMessages[entry.provider];
        return (
          <li className="signin-picker__item" key={entry.provider}>
            <div className="signin-picker__row">
              <Button
                variant="secondary"
                size="m"
                data-provider={entry.provider}
                onClick={() => onPick(entry.provider)}
                disabled={disabled}
              >
                {entry.label}
              </Button>
            </div>
            {message ? (
              <p
                className="signin-picker__error tinker-muted"
                data-provider-error={entry.provider}
                role="alert"
              >
                {message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>

    <p className="signin-picker__footnote tinker-muted">
      Tokens stay on this device. We never see them.
    </p>
  </section>
);
