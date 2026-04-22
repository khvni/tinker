import type { AuthProvider } from '../../../bindings.js';
import { ProviderPicker } from './components/ProviderPicker/index.js';
import { WaitingForBrowser } from './components/WaitingForBrowser/index.js';
import { useAuthSignIn } from './hooks/useAuthSignIn.js';
import './SignIn.css';

export type SignInProps = {
  readonly nativeRuntimeAvailable: boolean;
  readonly providerMessages: Partial<Record<AuthProvider, string | null>>;
  readonly onSignIn: (provider: AuthProvider) => Promise<void>;
};

export const SignIn = ({
  nativeRuntimeAvailable,
  providerMessages,
  onSignIn,
}: SignInProps) => {
  const { state, pendingProvider, showRetry, start, cancel } = useAuthSignIn(onSignIn);

  const isPicker = state !== 'signing-in' || pendingProvider === null;

  return (
    <div className="signin-shell" data-state={state}>
      <main className="signin-shell__card tinker-card" role="main">
        {isPicker ? (
          <ProviderPicker
            disabled={!nativeRuntimeAvailable}
            providerMessages={providerMessages}
            onPick={(provider) => {
              void start(provider);
            }}
          />
        ) : (
          <WaitingForBrowser
            provider={pendingProvider}
            showRetry={showRetry}
            onCancel={cancel}
            onRetry={() => {
              void start(pendingProvider);
            }}
          />
        )}
      </main>
    </div>
  );
};
