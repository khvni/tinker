import { readTextFile } from '@tauri-apps/plugin-fs';
import type { Entity, EntitySource, MemorySearchResult, MemoryStore, Relationship } from '@tinker/shared-types';
import type { VaultConfig } from '@tinker/shared-types/vault';
import { getDatabase } from './database.js';
import { extractEntities } from './entity-extractor.js';
import { deriveNoteTitle, parseFrontmatter, relativeVaultPath, walkMarkdownFiles } from './vault-utils.js';

const normalizeAliases = (aliases: string[]): string => aliases.join(' ');

const hydrateEntity = (row: {
  id: string;
  kind: Entity['kind'];
  name: string;
  aliases_json: string;
  sources_json: string;
  attributes_json: string;
  last_seen_at: string;
}): Entity => {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    aliases: JSON.parse(row.aliases_json) as string[],
    sources: JSON.parse(row.sources_json) as EntitySource[],
    attributes: JSON.parse(row.attributes_json) as Record<string, unknown>,
    lastSeenAt: row.last_seen_at,
  };
};

const tokenizeQuery = (query: string): string | null => {
  const terms = query
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(' OR ');
};

const deleteEntityRecord = async (database: Awaited<ReturnType<typeof getDatabase>>, id: string): Promise<void> => {
  await database.execute('DELETE FROM entities WHERE id = $1', [id]);
  await database.execute('DELETE FROM entities_fts WHERE id = $1', [id]);
};

const getVaultEntityIds = async (database: Awaited<ReturnType<typeof getDatabase>>): Promise<string[]> => {
  const rows = await database.select<Array<{ id: string; sources_json: string }>>('SELECT id, sources_json FROM entities');

  return rows
    .filter((row) => {
      try {
        const sources = JSON.parse(row.sources_json) as EntitySource[];
        return sources.some((source) => source.integration === 'vault');
      } catch {
        return false;
      }
    })
    .map((row) => row.id);
};

export const createMemoryStore = (): MemoryStore => {
  return {
    async upsertEntity(entity: Entity): Promise<void> {
      const database = await getDatabase();

      await database.execute(
        `INSERT INTO entities (id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           name = excluded.name,
           aliases_json = excluded.aliases_json,
           sources_json = excluded.sources_json,
           attributes_json = excluded.attributes_json,
           last_seen_at = excluded.last_seen_at`,
        [
          entity.id,
          entity.kind,
          entity.name,
          JSON.stringify(entity.aliases),
          JSON.stringify(entity.sources),
          JSON.stringify(entity.attributes),
          entity.lastSeenAt,
        ],
      );

      await database.execute('DELETE FROM entities_fts WHERE id = $1', [entity.id]);
      await database.execute(
        'INSERT INTO entities_fts (id, name, aliases) VALUES ($1, $2, $3)',
        [entity.id, entity.name, normalizeAliases(entity.aliases)],
      );
    },

    async upsertRelationship(rel: Relationship): Promise<void> {
      const database = await getDatabase();

      await database.execute(
        `INSERT INTO relationships (subject_id, predicate, object_id, confidence, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(subject_id, predicate, object_id) DO UPDATE SET
           confidence = excluded.confidence,
           source = excluded.source`,
        [rel.subjectId, rel.predicate, rel.objectId, rel.confidence, rel.source],
      );
    },

    async getEntity(id: string): Promise<Entity | null> {
      const database = await getDatabase();
      const rows = await database.select<
        Array<{
          id: string;
          kind: Entity['kind'];
          name: string;
          aliases_json: string;
          sources_json: string;
          attributes_json: string;
          last_seen_at: string;
        }>
      >(
        `SELECT id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at
         FROM entities
         WHERE id = $1
         LIMIT 1`,
        [id],
      );

      const row = rows[0];
      return row ? hydrateEntity(row) : null;
    },

    async search(query: string, limit = 8): Promise<MemorySearchResult[]> {
      const database = await getDatabase();
      const tokenized = tokenizeQuery(query);

      if (!tokenized) {
        return [];
      }

      const rows = await database.select<
        Array<{
          id: string;
          kind: Entity['kind'];
          name: string;
          aliases_json: string;
          sources_json: string;
          attributes_json: string;
          last_seen_at: string;
          rank: number;
        }>
      >(
        `SELECT
           e.id,
           e.kind,
           e.name,
           e.aliases_json,
           e.sources_json,
           e.attributes_json,
           e.last_seen_at,
           bm25(entities_fts) AS rank
         FROM entities_fts
         JOIN entities e ON e.id = entities_fts.id
         WHERE entities_fts MATCH $1
         ORDER BY rank
         LIMIT $2`,
        [tokenized, limit],
      );

      return rows.map((row) => ({
        entity: hydrateEntity(row),
        score: 1 / (1 + Math.max(row.rank, 0)),
      }));
    },

    async recentEntities(limit: number): Promise<Entity[]> {
      const database = await getDatabase();
      const rows = await database.select<
        Array<{
          id: string;
          kind: Entity['kind'];
          name: string;
          aliases_json: string;
          sources_json: string;
          attributes_json: string;
          last_seen_at: string;
        }>
      >(
        `SELECT id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at
         FROM entities
         ORDER BY datetime(last_seen_at) DESC
         LIMIT $1`,
        [limit],
      );

      return rows.map(hydrateEntity);
    },
  };
};

export const indexVault = async (vault: VaultConfig): Promise<{ entitiesIndexed: number }> => {
  const memoryStore = createMemoryStore();
  const database = await getDatabase();
  const files = await walkMarkdownFiles(vault.path);
  const nextEntities: Entity[] = [];
  let hadIndexingFailure = false;

  for (const absolutePath of files) {
    try {
      const text = await readTextFile(absolutePath);
      const { frontmatter, body } = parseFrontmatter(text);
      const relativePath = relativeVaultPath(vault.path, absolutePath);
      const title = deriveNoteTitle(relativePath, frontmatter, body);

      nextEntities.push({
        id: `vault:${relativePath}`,
        kind: 'document',
        name: title,
        aliases: [],
        sources: [{ integration: 'vault', externalId: relativePath }],
        attributes: {
          frontmatter,
          preview: body.slice(0, 280),
          isNewVault: vault.isNew,
        },
        lastSeenAt: new Date().toISOString(),
      });

      const extractedEntities = extractEntities(body, relativePath);
      nextEntities.push(...extractedEntities);
    } catch (error) {
      hadIndexingFailure = true;
      console.warn(`Skipping vault file during indexing: ${absolutePath}`, error);
    }
  }

  await Promise.all(nextEntities.map((entity) => memoryStore.upsertEntity(entity)));

  if (!hadIndexingFailure) {
    const staleVaultEntityIds = await getVaultEntityIds(database);
    const nextEntityIds = new Set(nextEntities.map((entity) => entity.id));
    await Promise.all(
      staleVaultEntityIds
        .filter((id) => !nextEntityIds.has(id))
        .map((id) => deleteEntityRecord(database, id)),
    );
  }

  return { entitiesIndexed: nextEntities.length };
};

export const runDailySynthesis = async (userId: string): Promise<{ summary: string }> => {
  const recentEntities = await createMemoryStore().recentEntities(5);
  const summary =
    recentEntities.length === 0
      ? `No recent entities available for ${userId}.`
      : `Recent entities for ${userId}: ${recentEntities.map((entity) => entity.name).join(', ')}`;

  return { summary };
};

export { createLayoutStore } from './layout-store.js';
export { extractEntities } from './entity-extractor.js';
export { createVaultService } from './vault-service.js';
export { deriveNoteTitle, parseFrontmatter, relativeVaultPath, resolveVaultPath, serializeFrontmatter, walkMarkdownFiles, walkVaultFiles } from './vault-utils.js';
export type { LayoutStore } from '@tinker/shared-types';
