import Database from '@tauri-apps/plugin-sql';

const DEFAULT_SQL_URL = 'sqlite:tinker.db';

let databasePromise: Promise<Database> | null = null;

const schema = [
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
    dockview_model_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
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
  `CREATE TABLE IF NOT EXISTS memory_runs (
    run_key TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    last_started_at TEXT,
    last_completed_at TEXT,
    last_error TEXT
  )`,
];

const bootstrap = async (database: Database): Promise<Database> => {
  for (const statement of schema) {
    await database.execute(statement);
  }

  return database;
};

export const getDatabase = async (sqlUrl = DEFAULT_SQL_URL): Promise<Database> => {
  if (!databasePromise) {
    databasePromise = Database.load(sqlUrl).then(bootstrap);
  }

  return databasePromise;
};

export const resetDatabaseCache = (): void => {
  databasePromise = null;
};
