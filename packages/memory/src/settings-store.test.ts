import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getDatabase } from './database.js';
import { createSettingsStore, hydrateSettingRow, type AppSettingRow } from './settings-store.js';

vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

type SelectFn = (query: string, bindValues?: unknown[]) => Promise<unknown>;
type ExecuteFn = (query: string, bindValues?: unknown[]) => Promise<unknown>;

type MockDatabase = {
  select: Mock<SelectFn>;
  execute: Mock<ExecuteFn>;
};

const createMockDatabase = (): MockDatabase => ({
  select: vi.fn<SelectFn>(),
  execute: vi.fn<ExecuteFn>(),
});

describe('hydrateSettingRow', () => {
  it('returns null when no row is stored', () => {
    expect(hydrateSettingRow(undefined)).toBeNull();
  });

  it('hydrates valid JSON payloads', () => {
    const row: AppSettingRow = {
      key: 'memory_root',
      value_json: '{"path":"/tmp/tinker-memory"}',
      updated_at: '2026-04-21T00:00:00.000Z',
    };

    expect(hydrateSettingRow(row)).toEqual({
      key: 'memory_root',
      value: { path: '/tmp/tinker-memory' },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });
  });

  it('returns null and warns when the JSON payload is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      hydrateSettingRow({
        key: 'memory_root',
        value_json: '{ nope',
        updated_at: '2026-04-21T00:00:00.000Z',
      }),
    ).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});

describe('createSettingsStore', () => {
  const getDatabaseMock = vi.mocked(getDatabase);
  let database: MockDatabase;

  beforeEach(() => {
    database = createMockDatabase();
    getDatabaseMock.mockReset();
    getDatabaseMock.mockResolvedValue(database as unknown as Awaited<ReturnType<typeof getDatabase>>);
  });

  it('lists settings in key order and skips invalid rows', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    database.select.mockResolvedValue([
      {
        key: 'memory_auto_append',
        value_json: 'true',
        updated_at: '2026-04-21T00:01:00.000Z',
      },
      {
        key: 'memory_root',
        value_json: '{"path":"/tmp/tinker-memory"}',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
      {
        key: 'broken',
        value_json: '{ nope',
        updated_at: '2026-04-21T00:02:00.000Z',
      },
    ]);

    const store = createSettingsStore();

    await expect(store.list()).resolves.toEqual([
      {
        key: 'memory_auto_append',
        value: true,
        updatedAt: '2026-04-21T00:01:00.000Z',
      },
      {
        key: 'memory_root',
        value: { path: '/tmp/tinker-memory' },
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);
    expect(database.select).toHaveBeenCalledWith(
      expect.stringContaining('FROM app_settings'),
    );
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it('gets one setting by key', async () => {
    database.select.mockResolvedValue([
      {
        key: 'memory_root',
        value_json: '{"path":"/tmp/tinker-memory"}',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
    ]);

    const store = createSettingsStore();

    await expect(store.get<{ path: string }>('memory_root')).resolves.toEqual({
      key: 'memory_root',
      value: { path: '/tmp/tinker-memory' },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });
    expect(database.select).toHaveBeenCalledWith(expect.stringContaining('WHERE key = $1'), [
      'memory_root',
    ]);
  });

  it('upserts settings as JSON', async () => {
    database.execute.mockResolvedValue(undefined);

    const store = createSettingsStore();

    await store.set({
      key: 'memory_root',
      value: { path: '/tmp/tinker-memory' },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app_settings'),
      ['memory_root', '{"path":"/tmp/tinker-memory"}', '2026-04-21T00:00:00.000Z'],
    );
  });

  it('deletes settings by key', async () => {
    database.execute.mockResolvedValue(undefined);

    const store = createSettingsStore();

    await store.delete('memory_root');

    expect(database.execute).toHaveBeenCalledWith('DELETE FROM app_settings WHERE key = $1', [
      'memory_root',
    ]);
  });
});
