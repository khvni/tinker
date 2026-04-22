import Database from '@tauri-apps/plugin-sql';
import { DEFAULT_SESSION_MODE } from '@tinker/shared-types';

const DEFAULT_SQL_URL = 'sqlite:tinker.db';
const LAYOUT_STATE_COLUMN = 'workspace_state_json';
const LEGACY_LAYOUT_COLUMN = `dock${'view_model_json'}`;
const LEGACY_LAYOUT_TABLE = 'layouts_legacy';
const LEGACY_LAYOUT_BRAND = `Dock${'view'}`;

let databasePromise: Promise<Database> | null = null;

type TableInfoRow = {
  name: string;
};

type CountRow = {
  count: number;
};

export const DATABASE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases_json TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    attributes_json TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
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
    updated_at TEXT NOT NULL
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
];

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

export const getDatabase = async (sqlUrl = DEFAULT_SQL_URL): Promise<Database> => {
  if (!databasePromise) {
    databasePromise = Database.load(sqlUrl).then(async (database) => {
      for (const statement of DATABASE_SCHEMA) {
        await database.execute(statement);
      }
      await ensureSessionTableColumns(database);
      await ensureRelationshipTableColumns(database);
      await ensureLayoutTableShape(database);
      return database;
    });
  }

  return databasePromise;
};
