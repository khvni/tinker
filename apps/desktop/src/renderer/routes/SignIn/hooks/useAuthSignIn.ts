import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthProvider } from '../../../../bindings.js';

export type SignInState = 'idle' | 'signing-in';

export type UseAuthSignInReturn = {
  readonly state: SignInState;
  readonly pendingProvider: AuthProvider | null;
  readonly showRetry: boolean;
  start: (provider: AuthProvider) => Promise<void>;
  cancel: () => void;
};

/**
 * The Rust auth_sign_in command continues to poll the sidecar for up to 180s after
 * we stop awaiting it. Cancel is therefore a UI-only action: the underlying task
 * stays alive and will eventually time out, and the next start() invocation kicks
 * off a fresh ticket.
 */
export const RETRY_AFFORDANCE_DELAY_MS = 60_000;

/**
 * Helpers below stay pure + exported on purpose: the desktop app does not run jsdom
 * (no @testing-library/react), so tests cover the state-machine slices via these
 * helpers rather than rendering the hook itself. See useAuthSignIn.test.ts.
 */

export type SignInPhase = {
  readonly state: SignInState;
  readonly pendingProvider: AuthProvider | null;
  readonly showRetry: boolean;
};

export const IDLE_PHASE: SignInPhase = {
  state: 'idle',
  pendingProvider: null,
  showRetry: false,
};

export const phaseForStart = (provider: AuthProvider): SignInPhase => ({
  state: 'signing-in',
  pendingProvider: provider,
  showRetry: false,
});

export const phaseAfterRetryDelay = (current: SignInPhase): SignInPhase =>
  current.state === 'signing-in' ? { ...current, showRetry: true } : current;

export const useAuthSignIn = (
  onSignIn: (provider: AuthProvider) => Promise<void>,
): UseAuthSignInReturn => {
  const [phase, setPhase] = useState<SignInPhase>(IDLE_PHASE);
  const cancelTokenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase.state !== 'signing-in') {
      return;
    }

    const timerId = window.setTimeout(() => {
      setPhase((current) => phaseAfterRetryDelay(current));
    }, RETRY_AFFORDANCE_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [phase.state, phase.pendingProvider]);

  const start = useCallback(
    async (provider: AuthProvider): Promise<void> => {
      const ticket = cancelTokenRef.current + 1;
      cancelTokenRef.current = ticket;

      setPhase(phaseForStart(provider));

      try {
        await onSignIn(provider);
      } finally {
        if (mountedRef.current && cancelTokenRef.current === ticket) {
          // Whether it resolves or rejects, the parent re-renders with updated
          // providerMessages; the picker shows the new error annotation if any.
          setPhase(IDLE_PHASE);
        }
      }
    },
    [onSignIn],
  );

  const cancel = useCallback((): void => {
    cancelTokenRef.current += 1;
    setPhase(IDLE_PHASE);
  }, []);

  return {
    state: phase.state,
    pendingProvider: phase.pendingProvider,
    showRetry: phase.showRetry,
    start,
    cancel,
  };
};
