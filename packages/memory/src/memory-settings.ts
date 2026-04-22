import { createSettingsStore } from './settings-store.js';

export const MEMORY_AUTO_APPEND_SETTING_KEY = 'memory_auto_append';

const isBooleanSetting = (value: unknown): value is boolean => typeof value === 'boolean';

export const getMemoryAutoAppendEnabled = async (): Promise<boolean> => {
  const settingsStore = createSettingsStore();
  const setting = await settingsStore.get<boolean>(MEMORY_AUTO_APPEND_SETTING_KEY);

  if (setting && isBooleanSetting(setting.value)) {
    return setting.value;
  }

  const enabled = true;
  await settingsStore.set({
    key: MEMORY_AUTO_APPEND_SETTING_KEY,
    value: enabled,
    updatedAt: new Date().toISOString(),
  });

  return enabled;
};

export const setMemoryAutoAppendEnabled = async (enabled: boolean): Promise<void> => {
  const settingsStore = createSettingsStore();
  await settingsStore.set({
    key: MEMORY_AUTO_APPEND_SETTING_KEY,
    value: enabled,
    updatedAt: new Date().toISOString(),
  });
};
