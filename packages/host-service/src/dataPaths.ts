import { homedir, platform as nodePlatform } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * Platform-correct app data directories for the host daemon.
 *
 * macOS  : ~/Library/Application Support/Tinker/
 * Windows: %APPDATA%/Tinker/
 * Linux  : ~/.local/share/tinker/
 *
 * All subdirectories are created lazily on first access via `ensureDataPaths`.
 */

export type HostDataPaths = {
  /** Root data directory. */
  root: string;
  /** Host identity + adoption manifests. */
  host: string;
  /** Adoption manifest directory. */
  manifests: string;
  /** Run logs (per-run JSON or structured output). */
  runs: string;
  /** Notes metadata index. */
  notes: string;
  /** Memory indexes (entity graphs, embeddings). */
  memory: string;
  /** Workspace state snapshots. */
  workspaces: string;
  /** SQLite database directory. */
  db: string;
};

export type ResolveDataPathsOptions = {
  /** Override the root data directory. Useful for tests. */
  rootOverride?: string;
  /** Override `process.platform`. Useful for tests. */
  platformOverride?: NodeJS.Platform;
};

const resolveRoot = (plat: NodeJS.Platform): string => {
  const home = homedir();
  switch (plat) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Tinker');
    case 'win32':
      return join(process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), 'Tinker');
    default:
      return join(home, '.local', 'share', 'tinker');
  }
};

/**
 * Resolve all host data paths for the current platform.
 * Does NOT create directories — call `ensureDataPaths` for that.
 */
export const resolveDataPaths = (options: ResolveDataPathsOptions = {}): HostDataPaths => {
  const root = options.rootOverride ?? resolveRoot(options.platformOverride ?? nodePlatform());
  return {
    root,
    host: join(root, 'host'),
    manifests: join(root, 'host', 'manifests'),
    runs: join(root, 'runs'),
    notes: join(root, 'notes'),
    memory: join(root, 'memory'),
    workspaces: join(root, 'workspaces'),
    db: join(root, 'db'),
  };
};

/**
 * Create all data directories if they do not exist.
 * Idempotent — safe to call on every startup.
 */
export const ensureDataPaths = (paths: HostDataPaths): void => {
  const dirs = [paths.host, paths.manifests, paths.runs, paths.notes, paths.memory, paths.workspaces, paths.db] as const;
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
};
