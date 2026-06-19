import BetterSqlite3 from 'better-sqlite3';
import path from 'node:path';
import { DEFAULT_SESSION_MODE } from '@tinker/shared-types';

const DEFAULT_DB_NAME = 'tinker.db';
const LAYOUT_STATE_COLUMN = 'workspace_state_json';
const LEGACY_LAYOUT_COLUMN = `dock${'view_model_json'}`;
const LEGACY_LAYOUT_TABLE = 'layouts_legacy';
const LEGACY_LAYOUT_BRAND = `Dock${'view'}`;

type TableInfoRow = {
  name: string;
};

type CountRow = {
  count: number;
};

export type QueryResult = {
  rowsAffected: number;
  lastInsertId?: number;
};

export type Database = {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  close(): Promise<void>;
};

export const DATABASE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases_json TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    attributes_json TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    stale_since TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS relationships (
    subject_id TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object_id TEXT NOT NULL,
    confidence REAL NOT NULL,
    source TEXT NOT NULL,
    sources_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (subject_id, predicate, object_id)
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    id UNINDEXED,
    name,
    aliases
  )`,
  `CREATE TABLE IF NOT EXISTS layouts (
    user_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    workspace_state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    email TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_provider_provider_user_id_idx
    ON users (provider, provider_user_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT '${DEFAULT_SESSION_MODE}',
    model_id TEXT,
    reasoning_level TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_last_active_at_idx
    ON sessions (user_id, last_active_at)`,
  `CREATE TABLE IF NOT EXISTS skills (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tools_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    frontmatter_json TEXT NOT NULL,
    body TEXT NOT NULL,
    last_modified TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    installed_at TEXT NOT NULL
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
    slug UNINDEXED,
    title,
    description,
    tags,
    tools,
    body
  )`,
  `CREATE TABLE IF NOT EXISTS skill_git_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    remote_url TEXT NOT NULL,
    branch TEXT NOT NULL,
    author_name TEXT,
    author_email TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    schedule TEXT NOT NULL,
    timezone TEXT NOT NULL,
    output_sinks_json TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    last_run_at TEXT,
    last_run_status TEXT,
    next_run_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    task_kind TEXT NOT NULL DEFAULT 'prompt'
  )`,
  `CREATE TABLE IF NOT EXISTS job_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    status TEXT NOT NULL,
    output_text TEXT,
    error_text TEXT,
    delivered_sinks_json TEXT NOT NULL,
    skipped_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS memory_runs (
    run_key TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    last_started_at TEXT,
    last_completed_at TEXT,
    last_error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    context_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    body
  )`,
];

const toNamedParams = (params?: unknown[]): Record<string, unknown> | undefined => {
  if (!params || params.length === 0) return undefined;
  const named: Record<string, unknown> = {};
  for (let i = 0; i < params.length; i++) {
    named[String(i + 1)] = params[i] === undefined ? null : params[i];
  }
  return named;
};

const createDatabaseWrapper = (db: BetterSqlite3.Database): Database => {
  return {
    async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
      const stmt = db.prepare(sql);
      const named = toNamedParams(params);
      const result = named ? stmt.run(named) : stmt.run();
      const queryResult: QueryResult = { rowsAffected: result.changes };
      if (typeof result.lastInsertRowid === 'number') {
        queryResult.lastInsertId = result.lastInsertRowid;
      }
      return queryResult;
    },
    async select<T>(sql: string, params?: unknown[]): Promise<T> {
      const stmt = db.prepare(sql);
      const named = toNamedParams(params);
      return (named ? stmt.all(named) : stmt.all()) as T;
    },
    async close(): Promise<void> {
      db.close();
    },
  };
};

export const ensureSessionTableColumns = async (
  database: Pick<Database, 'execute' | 'select'>,
): Promise<void> => {
  const rows = await database.select<TableInfoRow[]>('PRAGMA table_info(sessions)');
  const columns = new Set(rows.map((row) => row.name));

  if (!columns.has('mode')) {
    await database.execute(
      `ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT '${DEFAULT_SESSION_MODE}'`,
    );
  }

  if (!columns.has('reasoning_level')) {
    await database.execute('ALTER TABLE sessions ADD COLUMN reasoning_level TEXT');
  }
};

export const ensureRelationshipTableColumns = async (
  database: Pick<Database, 'execute' | 'select'>,
): Promise<void> => {
  const rows = await database.select<TableInfoRow[]>('PRAGMA table_info(relationships)');
  const columns = new Set(rows.map((row) => row.name));

  if (!columns.has('sources_json')) {
    await database.execute("ALTER TABLE relationships ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'");
  }
};

export const ensureEntityTableColumns = async (
  database: Pick<Database, 'execute' | 'select'>,
): Promise<void> => {
  const rows = await database.select<TableInfoRow[]>('PRAGMA table_info(entities)');
  const columns = new Set(rows.map((row) => row.name));

  if (!columns.has('stale_since')) {
    await database.execute('ALTER TABLE entities ADD COLUMN stale_since TEXT');
  }
};

export const ensureJobTableColumns = async (
  database: Pick<Database, 'execute' | 'select'>,
): Promise<void> => {
  const rows = await database.select<TableInfoRow[]>('PRAGMA table_info(jobs)');
  const columns = new Set(rows.map((row) => row.name));

  if (!columns.has('task_kind')) {
    await database.execute("ALTER TABLE jobs ADD COLUMN task_kind TEXT NOT NULL DEFAULT 'prompt'");
  }
};

const ensureLayoutTableShape = async (database: Database): Promise<void> => {
  const columns = await database.select<TableInfoRow[]>(`PRAGMA table_info(layouts)`);
  const hasWorkspaceColumn = columns.some((column) => column.name === LAYOUT_STATE_COLUMN);
  if (hasWorkspaceColumn) {
    return;
  }

  const hasLegacyColumn = columns.some((column) => column.name === LEGACY_LAYOUT_COLUMN);
  if (!hasLegacyColumn) {
    await database.execute(`ALTER TABLE layouts ADD COLUMN ${LAYOUT_STATE_COLUMN} TEXT`);
    return;
  }

  const countRows = await database.select<CountRow[]>(`SELECT COUNT(*) AS count FROM layouts`);
  const dropped = countRows[0]?.count ?? 0;

  await database.execute(`DROP TABLE IF EXISTS ${LEGACY_LAYOUT_TABLE}`);
  await database.execute(`ALTER TABLE layouts RENAME TO ${LEGACY_LAYOUT_TABLE}`);
  await database.execute(
    `CREATE TABLE layouts (
      user_id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      workspace_state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await database.execute(`DROP TABLE ${LEGACY_LAYOUT_TABLE}`);

  if (dropped > 0) {
    console.warn(`Layout migration: dropped ${dropped} old ${LEGACY_LAYOUT_BRAND} snapshots`);
  }
};

const resolveDbPath = async (dbName = DEFAULT_DB_NAME): Promise<string> => {
  try {
    const moduleName = 'electron';
    const electron = await (import(/* @vite-ignore */ moduleName) as Promise<{ app: { getPath: (name: string) => string } }>);
    const userData = electron.app.getPath('userData');
    return path.join(userData, dbName);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as Record<string, unknown>)['code'] === 'MODULE_NOT_FOUND'
    ) {
      return path.join(process.cwd(), dbName);
    }
    if (
      error instanceof Error &&
      (error.message.includes('Cannot find module') || error.message.includes('is not defined'))
    ) {
      return path.join(process.cwd(), dbName);
    }
    throw error;
  }
};

let databasePromise: Promise<Database> | null = null;

export const getDatabase = async (dbPath?: string): Promise<Database> => {
  if (!databasePromise) {
    databasePromise = (async () => {
      const resolvedPath = dbPath ?? await resolveDbPath();
      const raw = new BetterSqlite3(resolvedPath);
      raw.pragma('journal_mode = WAL');
      raw.pragma('foreign_keys = ON');
      const database = createDatabaseWrapper(raw);

      for (const statement of DATABASE_SCHEMA) {
        await database.execute(statement);
      }
      await ensureSessionTableColumns(database);
      await ensureRelationshipTableColumns(database);
      await ensureEntityTableColumns(database);
      await ensureJobTableColumns(database);
      await ensureLayoutTableShape(database);
      return database;
    })();
  }

  return databasePromise;
};

export const resetDatabase = (): void => {
  databasePromise = null;
};
