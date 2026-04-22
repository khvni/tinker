import { getDatabase } from './database.js';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AppSettingRow = {
  key: string;
  value_json: string;
  updated_at: string;
};

export type AppSetting<T extends JsonValue = JsonValue> = {
  key: string;
  value: T;
  updatedAt: string;
};

export type SettingsStore = {
  list(): Promise<AppSetting[]>;
  get<T extends JsonValue = JsonValue>(key: string): Promise<AppSetting<T> | null>;
  set<T extends JsonValue>(setting: AppSetting<T>): Promise<void>;
  delete(key: string): Promise<void>;
};

const parseSettingValue = <T extends JsonValue>(key: string, raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`Ignoring stored app setting "${key}": value_json was not valid JSON.`);
    return null;
  }
};

export const hydrateSettingRow = <T extends JsonValue = JsonValue>(
  row: AppSettingRow | undefined,
): AppSetting<T> | null => {
  if (!row) {
    return null;
  }

  const value = parseSettingValue<T>(row.key, row.value_json);
  if (value === null && row.value_json.trim() !== 'null') {
    return null;
  }

  return {
    key: row.key,
    value: value as T,
    updatedAt: row.updated_at,
  };
};

export const createSettingsStore = (): SettingsStore => {
  return {
    async list(): Promise<AppSetting[]> {
      const database = await getDatabase();
      const rows = await database.select<AppSettingRow[]>(
        `SELECT key, value_json, updated_at
         FROM app_settings
         ORDER BY key ASC`,
      );

      return rows
        .map((row) => hydrateSettingRow(row))
        .filter((setting): setting is AppSetting => setting !== null);
    },

    async get<T extends JsonValue = JsonValue>(key: string): Promise<AppSetting<T> | null> {
      const database = await getDatabase();
      const rows = await database.select<AppSettingRow[]>(
        `SELECT key, value_json, updated_at
         FROM app_settings
         WHERE key = $1
         LIMIT 1`,
        [key],
      );

      return hydrateSettingRow<T>(rows[0]);
    },

    async set<T extends JsonValue>(setting: AppSetting<T>): Promise<void> {
      const database = await getDatabase();

      await database.execute(
        `INSERT INTO app_settings (key, value_json, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
        [setting.key, JSON.stringify(setting.value), setting.updatedAt],
      );
    },

    async delete(key: string): Promise<void> {
      const database = await getDatabase();
      await database.execute('DELETE FROM app_settings WHERE key = $1', [key]);
    },
  };
};
