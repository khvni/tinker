import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { Entity, EntityKind, EntitySource } from '@tinker/shared-types';
import type { VaultConfig } from '@tinker/shared-types/vault';
import { getDatabase } from './database.js';
import {
  appendManagedFacts,
  directoryForEntityKind,
  normalizeFactText,
  sanitizeEntityFileName,
} from './memory-utils.js';
import { findVaultNotePathByEntityName, indexVault } from './memory-store.js';
import { parseFrontmatter, resolveVaultPath, serializeFrontmatter } from './vault-utils.js';

export type MemoryFact = {
  text: string;
  date: string;
};

export type MemoryEntityUpdate = {
  name: string;
  kind: EntityKind;
  aliases?: string[];
  links?: string[];
  facts: MemoryFact[];
  sources?: EntitySource[];
};

export type MemoryWriteSummary = {
  created: string[];
  updated: string[];
  appendedFacts: number;
};

export type MemoryRunKey = 'daily-sweep';

export type MemoryRunStatus = 'idle' | 'running' | 'failed';

export type MemoryRunState = {
  key: MemoryRunKey;
  status: MemoryRunStatus;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
};

type MemoryRunRow = {
  run_key: MemoryRunKey;
  status: MemoryRunStatus;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
};

const DAILY_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let writeQueue: Promise<unknown> = Promise.resolve();

const enqueueMemoryWrite = <T>(task: () => Promise<T>): Promise<T> => {
  const next = writeQueue.then(task, task);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

const hydrateRunState = (row: MemoryRunRow | undefined, key: MemoryRunKey): MemoryRunState => {
  if (!row) {
    return {
      key,
      status: 'idle',
      lastStartedAt: null,
      lastCompletedAt: null,
      lastError: null,
    };
  }

  return {
    key: row.run_key,
    status: row.status,
    lastStartedAt: row.last_started_at,
    lastCompletedAt: row.last_completed_at,
    lastError: row.last_error,
  };
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item, index, values) => item.length > 0 && values.indexOf(item) === index);
};

const mergeAliases = (current: Record<string, unknown>, nextAliases: string[] | undefined): Record<string, unknown> => {
  const currentAliases = readStringArray(current.aliases);
  const aliases = Array.from(new Set([...currentAliases, ...(nextAliases ?? [])]));

  if (aliases.length === 0) {
    return current;
  }

  if (aliases.length === currentAliases.length && aliases.every((alias, index) => alias === currentAliases[index])) {
    return current;
  }

  return {
    ...current,
    aliases,
  };
};

const normalizeUpdate = (update: MemoryEntityUpdate): MemoryEntityUpdate | null => {
  const name = update.name.trim();
  if (name.length === 0) {
    return null;
  }

  const facts = update.facts
    .map((fact) => ({
      date: fact.date.trim(),
      text: normalizeFactText(fact.text),
    }))
    .filter((fact) => fact.date.length > 0 && fact.text.length > 0);

  if (facts.length === 0) {
    return null;
  }

  const aliases = update.aliases?.map((alias) => alias.trim()).filter(Boolean);
  const links = update.links?.map((link) => link.trim()).filter(Boolean);

  return {
    name,
    kind: update.kind,
    facts,
    ...(aliases ? { aliases } : {}),
    ...(links ? { links } : {}),
    ...(update.sources ? { sources: update.sources } : {}),
  };
};

const defaultRelativePathForEntity = (kind: EntityKind, name: string): string => {
  return `${directoryForEntityKind(kind)}/${sanitizeEntityFileName(name)}.md`;
};

const writeEntityUpdate = async (
  vault: VaultConfig,
  update: MemoryEntityUpdate,
): Promise<{ created: boolean; wrote: boolean; relativePath: string; appendedFacts: number }> => {
  const existingRelativePath = await findVaultNotePathByEntityName(update.name);
  const relativePath = existingRelativePath ?? defaultRelativePathForEntity(update.kind, update.name);
  const absolutePath = resolveVaultPath(vault.path, relativePath);
  const noteExists = await exists(absolutePath);
  const rawText = noteExists ? await readTextFile(absolutePath) : '';
  const parsed = parseFrontmatter(rawText);
  const frontmatter = noteExists ? mergeAliases(parsed.frontmatter, update.aliases) : mergeAliases({ type: update.kind }, update.aliases);
  const baseBody = noteExists ? parsed.body : `# ${update.name}\n`;
  const merged = appendManagedFacts(baseBody, update.facts);

  if (!noteExists && relativePath.includes('/')) {
    const directory = relativePath.slice(0, relativePath.lastIndexOf('/'));
    await mkdir(resolveVaultPath(vault.path, directory), { recursive: true });
  }

  if (!noteExists || merged.appended > 0 || frontmatter !== parsed.frontmatter) {
    await writeTextFile(absolutePath, serializeFrontmatter(frontmatter, merged.body));
  }

  return {
    created: !noteExists,
    wrote: !noteExists || merged.appended > 0 || frontmatter !== parsed.frontmatter,
    relativePath,
    appendedFacts: merged.appended,
  };
};

const setRunState = async (
  key: MemoryRunKey,
  state: Omit<MemoryRunState, 'key'>,
): Promise<MemoryRunState> => {
  const database = await getDatabase();
  await database.execute(
    `INSERT INTO memory_runs (run_key, status, last_started_at, last_completed_at, last_error)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(run_key) DO UPDATE SET
       status = excluded.status,
       last_started_at = excluded.last_started_at,
       last_completed_at = excluded.last_completed_at,
       last_error = excluded.last_error`,
    [key, state.status, state.lastStartedAt, state.lastCompletedAt, state.lastError],
  );

  return {
    key,
    ...state,
  };
};

export const getMemoryRunState = async (key: MemoryRunKey): Promise<MemoryRunState> => {
  const database = await getDatabase();
  const rows = await database.select<MemoryRunRow[]>(
    `SELECT run_key, status, last_started_at, last_completed_at, last_error
     FROM memory_runs
     WHERE run_key = $1
     LIMIT 1`,
    [key],
  );

  return hydrateRunState(rows[0], key);
};

export const shouldRunDailySweep = async (now = new Date()): Promise<boolean> => {
  const state = await getMemoryRunState('daily-sweep');
  if (!state.lastCompletedAt) {
    return state.status !== 'running';
  }

  const lastCompletedAt = Date.parse(state.lastCompletedAt);
  if (Number.isNaN(lastCompletedAt)) {
    return true;
  }

  if (state.status === 'running' && state.lastStartedAt) {
    const startedAt = Date.parse(state.lastStartedAt);
    if (!Number.isNaN(startedAt) && now.getTime() - startedAt < 60 * 60 * 1000) {
      return false;
    }
  }

  return now.getTime() - lastCompletedAt >= DAILY_SWEEP_INTERVAL_MS;
};

export const applyMemoryUpdates = async (
  vault: VaultConfig,
  updates: MemoryEntityUpdate[],
  options?: { runKey?: MemoryRunKey },
): Promise<MemoryWriteSummary> => {
  const normalizedUpdates = updates.map(normalizeUpdate).filter((update): update is MemoryEntityUpdate => Boolean(update));

  return enqueueMemoryWrite(async () => {
    const startedAt = new Date().toISOString();
    if (options?.runKey) {
      await setRunState(options.runKey, {
        status: 'running',
        lastStartedAt: startedAt,
        lastCompletedAt: null,
        lastError: null,
      });
    }

    try {
      const created = new Set<string>();
      const updated = new Set<string>();
      let appendedFacts = 0;

      for (const update of normalizedUpdates) {
        const result = await writeEntityUpdate(vault, update);
        if (result.created) {
          created.add(result.relativePath);
        } else if (result.wrote) {
          updated.add(result.relativePath);
        }
        appendedFacts += result.appendedFacts;
      }

      if (created.size > 0 || updated.size > 0) {
        await indexVault(vault);
      }

      if (options?.runKey) {
        await setRunState(options.runKey, {
          status: 'idle',
          lastStartedAt: startedAt,
          lastCompletedAt: new Date().toISOString(),
          lastError: null,
        });
      }

      return {
        created: Array.from(created),
        updated: Array.from(updated),
        appendedFacts,
      };
    } catch (error) {
      if (options?.runKey) {
        await setRunState(options.runKey, {
          status: 'failed',
          lastStartedAt: startedAt,
          lastCompletedAt: null,
          lastError: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  });
};

export const summarizeEntityNames = (entities: Entity[]): string => {
  return entities.map((entity) => entity.name).join(', ');
};
