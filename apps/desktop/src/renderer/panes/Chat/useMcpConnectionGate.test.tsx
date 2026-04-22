import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMcpConnectionGate } from './useMcpConnectionGate.js';

describe('useMcpConnectionGate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('unblocks once all builtin MCPs report connected', async () => {
    const loadStatus = vi.fn().mockResolvedValue({
      data: {
        qmd: { status: 'connected' },
        'smart-connections': { status: 'connected' },
        exa: { status: 'connected' },
      },
    });

    const { result } = renderHook(() =>
      useMcpConnectionGate({
        enabled: true,
        loadStatus,
      }),
    );

    await waitFor(() => {
      expect(result.current.blocked).toBe(false);
    });

    expect(loadStatus).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBeNull();
    expect(result.current.visible).toBe(false);
  });

  it('times out and enables the composer anyway when MCPs stay pending', async () => {
    const loadStatus = vi.fn().mockResolvedValue({
      data: {
        qmd: { status: 'connected' },
        'smart-connections': { status: 'checking' },
        exa: { status: 'checking' },
      },
    });

    const { result } = renderHook(() =>
      useMcpConnectionGate({
        enabled: true,
        loadStatus,
        timeoutMs: 50,
        pollIntervalMs: 10,
      }),
    );

    await waitFor(() => {
      expect(result.current.notice).toBe('Tools took longer than 10 seconds. Composer enabled anyway.');
    });

    expect(result.current.blocked).toBe(false);
    expect(result.current.visible).toBe(false);
  });

  it('enters the error state until the user skips or retries', async () => {
    const loadStatus = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          qmd: { status: 'connected' },
          'smart-connections': { status: 'connected' },
          exa: { status: 'error', error: 'Socket closed' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          qmd: { status: 'connected' },
          'smart-connections': { status: 'connected' },
          exa: { status: 'connected' },
        },
      });

    const { result } = renderHook(() =>
      useMcpConnectionGate({
        enabled: true,
        loadStatus,
      }),
    );

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('Socket closed');
    });

    act(() => {
      result.current.skip();
    });

    await waitFor(() => {
      expect(result.current.blocked).toBe(false);
    });

    expect(result.current.notice).toContain('Skipped tool check for now.');

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(loadStatus).toHaveBeenCalledTimes(2);
      expect(result.current.visible).toBe(false);
    });

    expect(result.current.errorMessage).toBeNull();
  });
});
