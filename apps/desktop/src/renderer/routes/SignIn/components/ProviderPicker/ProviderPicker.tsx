import { Button } from '@tinker/design';
import type { AuthProvider } from '../../../../../bindings.js';
import './ProviderPicker.css';

export type ProviderPickerProps = {
  readonly onPick: (provider: AuthProvider) => void;
  readonly disabled: boolean;
  readonly providerBusy?: Partial<Record<AuthProvider, boolean>>;
  readonly providerMessages: Partial<Record<AuthProvider, string | null>>;
  readonly onContinueAsGuest?: () => void;
  readonly guestBusy?: boolean;
  readonly guestMessage?: string | null;
  readonly guestLabel?: string;
  readonly eyebrow?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly footnote?: string | null;
  readonly headingLevel?: 'h1' | 'h2';
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
  providerBusy,
  providerMessages,
  onContinueAsGuest,
  guestBusy = false,
  guestMessage = null,
  guestLabel = 'Continue as guest',
  eyebrow = 'Welcome',
  title = 'Sign in to Tinker',
  subtitle = "Pick a provider — we'll redirect you to it in your browser. Your tokens stay on this device.",
  footnote = 'Tokens stay on this device. We never see them.',
  headingLevel = 'h1',
}: ProviderPickerProps) => {
  const Heading = headingLevel;

  return (
  <section className="signin-picker" aria-labelledby="signin-picker-title">
    <header className="signin-picker__header">
      <p className="tinker-eyebrow">{eyebrow}</p>
      <Heading className="signin-picker__title" id="signin-picker-title">
        {title}
      </Heading>
      <p className="signin-picker__subtitle tinker-muted">
        {subtitle}
      </p>
    </header>

    <ul className="signin-picker__list">
      {onContinueAsGuest ? (
        <li className="signin-picker__item">
          <div className="signin-picker__row">
            <Button
              variant="primary"
              size="m"
              data-guest-action="true"
              onClick={onContinueAsGuest}
              disabled={disabled || guestBusy}
            >
              {guestBusy ? 'Continuing…' : guestLabel}
            </Button>
          </div>
          {guestMessage ? (
            <p
              className="signin-picker__error tinker-muted"
              data-guest-error="true"
              role="alert"
            >
              {guestMessage}
            </p>
          ) : null}
        </li>
      ) : null}

      {PROVIDERS.map((entry) => {
        const message = providerMessages[entry.provider];
        const busy = providerBusy?.[entry.provider] ?? false;
        return (
          <li className="signin-picker__item" key={entry.provider}>
            <div className="signin-picker__row">
              <Button
                variant="secondary"
                size="m"
                data-provider={entry.provider}
                onClick={() => onPick(entry.provider)}
                disabled={disabled || busy}
              >
                {busy ? 'Connecting…' : entry.label}
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

    {footnote ? <p className="signin-picker__footnote tinker-muted">{footnote}</p> : null}
  </section>
  );
};
