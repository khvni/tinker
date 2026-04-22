import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emitMemoryPathChanged,
  resetMemoryPathChangedListeners,
  subscribeMemoryPathChanged,
} from './events.js';

describe('memory path change events', () => {
  afterEach(() => {
    resetMemoryPathChangedListeners();
  });

  it('notifies every subscriber for the shared memory.path-changed event', () => {
    const first = vi.fn();
    const second = vi.fn();

    subscribeMemoryPathChanged(first);
    subscribeMemoryPathChanged(second);

    emitMemoryPathChanged({
      reason: 'user-changed',
      previousUserId: 'local-user',
      nextUserId: 'google:user-1',
    });

    expect(first).toHaveBeenCalledWith({
      reason: 'user-changed',
      previousUserId: 'local-user',
      nextUserId: 'google:user-1',
    });
    expect(second).toHaveBeenCalledWith({
      reason: 'user-changed',
      previousUserId: 'local-user',
      nextUserId: 'google:user-1',
    });
  });

  it('supports unsubscribe cleanup without affecting remaining listeners', () => {
    const kept = vi.fn();
    const removed = vi.fn();

    subscribeMemoryPathChanged(kept);
    const unsubscribe = subscribeMemoryPathChanged(removed);
    unsubscribe();

    emitMemoryPathChanged({
      reason: 'root-changed',
      previousRoot: '/memory-a',
      nextRoot: '/memory-b',
    });

    expect(kept).toHaveBeenCalledOnce();
    expect(removed).not.toHaveBeenCalled();
  });

  it('continues notifying later listeners when one subscriber throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const second = vi.fn();

    subscribeMemoryPathChanged(() => {
      throw new Error('boom');
    });
    subscribeMemoryPathChanged(second);

    emitMemoryPathChanged({
      reason: 'root-changed',
      previousRoot: '/memory-a',
      nextRoot: '/memory-b',
    });

    expect(second).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});
