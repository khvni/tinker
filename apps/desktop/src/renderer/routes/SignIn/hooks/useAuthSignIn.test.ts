import { describe, expect, it } from 'vitest';
import {
  IDLE_PHASE,
  RETRY_AFFORDANCE_DELAY_MS,
  phaseAfterRetryDelay,
  phaseForStart,
} from './useAuthSignIn.js';

describe('useAuthSignIn state machine', () => {
  describe('phaseForStart', () => {
    it('transitions to signing-in with the given provider and showRetry off', () => {
      expect(phaseForStart('google')).toEqual({
        state: 'signing-in',
        pendingProvider: 'google',
        showRetry: false,
      });
    });

    it('starting a different provider replaces the pending provider', () => {
      const first = phaseForStart('google');
      const second = phaseForStart('github');
      expect(second.pendingProvider).toBe('github');
      // showRetry resets when a new attempt begins
      expect(second.showRetry).toBe(false);
      expect(first).not.toBe(second);
    });
  });

  describe('phaseAfterRetryDelay', () => {
    it('flips showRetry on while signing-in', () => {
      const next = phaseAfterRetryDelay(phaseForStart('microsoft'));
      expect(next.showRetry).toBe(true);
      expect(next.state).toBe('signing-in');
      expect(next.pendingProvider).toBe('microsoft');
    });

    it('is a no-op once the phase has returned to idle', () => {
      // Models the case where start() resolves (or cancel() runs) before the 60s
      // timer fires — the timer callback should not resurrect signing-in.
      expect(phaseAfterRetryDelay(IDLE_PHASE)).toBe(IDLE_PHASE);
    });
  });

  describe('IDLE_PHASE', () => {
    it('represents the resting state after both success and failure', () => {
      // After start() resolves OR rejects we drop straight back here. Errors are
      // owned by the parent (App.tsx providerMessages), not by the hook, so the
      // state machine has no error node.
      expect(IDLE_PHASE).toEqual({
        state: 'idle',
        pendingProvider: null,
        showRetry: false,
      });
    });
  });

  describe('RETRY_AFFORDANCE_DELAY_MS', () => {
    it('exposes the 60s wait that drives the reopen-browser affordance', () => {
      expect(RETRY_AFFORDANCE_DELAY_MS).toBe(60_000);
    });
  });
});
