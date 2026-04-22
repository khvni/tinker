import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from './settings-store.js';
import { getMemoryAutoAppendEnabled, MEMORY_AUTO_APPEND_SETTING_KEY, setMemoryAutoAppendEnabled } from './memory-settings.js';

vi.mock('./settings-store.js', () => ({
  createSettingsStore: vi.fn(),
}));

describe('memory auto-append setting helpers', () => {
  const createSettingsStoreMock = vi.mocked(createSettingsStore);
  const get = vi.fn();
  const set = vi.fn();

  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    createSettingsStoreMock.mockReset();
    createSettingsStoreMock.mockReturnValue({
      list: vi.fn(),
      get,
      set,
      delete: vi.fn(),
    });
  });

  it('returns a stored boolean without rewriting it', async () => {
    get.mockResolvedValue({
      key: MEMORY_AUTO_APPEND_SETTING_KEY,
      value: false,
      updatedAt: '2026-04-22T00:00:00.000Z',
    });

    await expect(getMemoryAutoAppendEnabled()).resolves.toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it('seeds the setting to true when unset', async () => {
    get.mockResolvedValue(null);
    set.mockResolvedValue(undefined);

    await expect(getMemoryAutoAppendEnabled()).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        key: MEMORY_AUTO_APPEND_SETTING_KEY,
        value: true,
      }),
    );
  });

  it('persists explicit updates', async () => {
    set.mockResolvedValue(undefined);

    await setMemoryAutoAppendEnabled(false);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        key: MEMORY_AUTO_APPEND_SETTING_KEY,
        value: false,
      }),
    );
  });
});
