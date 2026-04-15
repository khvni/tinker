import { readTextFile } from '@tauri-apps/plugin-fs';
import type { Entity, EntitySource, MemorySearchResult, MemoryStore, Relationship } from '@tinker/shared-types';
import type { VaultConfig } from '@tinker/shared-types/vault';
import { getDatabase } from './database.js';
import { extractEntities } from './entity-extractor.js';
import { buildPreview, collectWikilinks, createVaultEntitySource, inferEntityKindFromNote, readEntityAliases } from './memory-utils.js';
import { deriveNoteTitle, parseFrontmatter, relativeVaultPath, walkMarkdownFiles } from './vault-utils.js';

type EntityRow = {
  id: string;
  kind: Entity['kind'];
  name: string;
  aliases_json: string;
  sources_json: string;
  attributes_json: string;
  last_seen_at: string;
};

type IndexedNote = {
  entity: Entity;
  body: string;
  links: string[];
};

const normalizeSearchContent = (entity: Entity): string => {
  const preview = typeof entity.attributes.preview === 'string' ? entity.attributes.preview : '';
  const excerpt = typeof entity.attributes.excerpt === 'string' ? entity.attributes.excerpt : '';
  const relativePath = typeof entity.attributes.relativePath === 'string' ? entity.attributes.relativePath : '';
  const links = Array.isArray(entity.attributes.links)
    ? entity.attributes.links.filter((value): value is string => typeof value === 'string')
    : [];

  return [entity.aliases.join(' '), preview, excerpt, relativePath, links.join(' ')].filter(Boolean).join(' ');
};

const hydrateEntity = (row: EntityRow): Entity => {
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

const clearVaultRelationships = async (database: Awaited<ReturnType<typeof getDatabase>>): Promise<void> => {
  await database.execute(`DELETE FROM relationships WHERE source LIKE 'vault:%'`);
};

const selectEntitiesByIds = async (ids: string[]): Promise<Entity[]> => {
  if (ids.length === 0) {
    return [];
  }

  const database = await getDatabase();
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await database.select<EntityRow[]>(
    `SELECT id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at
     FROM entities
     WHERE id IN (${placeholders})`,
    ids,
  );

  const entityById = new Map(rows.map((row) => [row.id, hydrateEntity(row)]));
  return ids.map((id) => entityById.get(id)).filter((entity): entity is Entity => Boolean(entity));
};

const indexNote = async (vault: VaultConfig, absolutePath: string): Promise<IndexedNote> => {
  const text = await readTextFile(absolutePath);
  const { frontmatter, body } = parseFrontmatter(text);
  const relativePath = relativeVaultPath(vault.path, absolutePath);
  const title = deriveNoteTitle(relativePath, frontmatter, body);
  const links = collectWikilinks(body);
  const entity: Entity = {
    id: `vault:${relativePath}`,
    kind: inferEntityKindFromNote(relativePath, frontmatter),
    name: title,
    aliases: readEntityAliases(frontmatter),
    sources: createVaultEntitySource(relativePath),
    attributes: {
      frontmatter,
      preview: buildPreview(body, 220),
      excerpt: buildPreview(body, 420),
      relativePath,
      links,
      isNewVault: vault.isNew,
    },
    lastSeenAt: new Date().toISOString(),
  };

  return { entity, body, links };
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
        [entity.id, entity.name, normalizeSearchContent(entity)],
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
      const rows = await database.select<EntityRow[]>(
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

      const rows = await database.select<Array<EntityRow & { rank: number }>>(
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
      const rows = await database.select<EntityRow[]>(
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
  const indexedNotes: IndexedNote[] = [];
  let hadIndexingFailure = false;

  for (const absolutePath of files) {
    try {
      const note = await indexNote(vault, absolutePath);
      indexedNotes.push(note);
      nextEntities.push(note.entity);

      const extractedEntities = extractEntities(note.body, note.entity.id);
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

    await clearVaultRelationships(database);

    const noteIdByName = new Map(
      indexedNotes.map((note) => [note.entity.name.toLowerCase(), note.entity.id] as const),
    );

    await Promise.all(
      indexedNotes.flatMap((note) =>
        note.links
          .map((target) => noteIdByName.get(target.toLowerCase()))
          .filter((targetId): targetId is string => Boolean(targetId) && targetId !== note.entity.id)
          .map((targetId) =>
            memoryStore.upsertRelationship({
              subjectId: note.entity.id,
              predicate: 'references',
              objectId: targetId,
              confidence: 1,
              source: `vault:${note.entity.attributes.relativePath as string}`,
            }),
          ),
      ),
    );
  }

  return { entitiesIndexed: nextEntities.length };
};

export const resolveRelevantEntities = async (query: string, limit = 6): Promise<Entity[]> => {
  const memoryStore = createMemoryStore();
  const searchResults = await memoryStore.search(query, limit);

  if (searchResults.length === 0) {
    return memoryStore.recentEntities(limit);
  }

  const seedEntities = searchResults.map((result) => result.entity);
  const seedIds = seedEntities.map((entity) => entity.id);
  const database = await getDatabase();
  const placeholders = seedIds.map((_, index) => `$${index + 1}`).join(', ');
  const relatedRows = await database.select<Array<{ subject_id: string; object_id: string }>>(
    `SELECT subject_id, object_id
     FROM relationships
     WHERE subject_id IN (${placeholders}) OR object_id IN (${placeholders})
     LIMIT $${seedIds.length + 1}`,
    [...seedIds, limit * 4],
  );

  const relatedIds = Array.from(
    new Set(
      relatedRows
        .flatMap((row) => [row.subject_id, row.object_id])
        .filter((id) => !seedIds.includes(id)),
    ),
  ).slice(0, limit);

  const relatedEntities = await selectEntitiesByIds(relatedIds);
  const deduped = new Map<string, Entity>();
  for (const entity of [...seedEntities, ...relatedEntities]) {
    deduped.set(entity.id, entity);
  }

  return Array.from(deduped.values()).slice(0, limit);
};

export const findVaultNotePathByEntityName = async (name: string): Promise<string | null> => {
  const database = await getDatabase();
  const rows = await database.select<Array<{ sources_json: string }>>(
    `SELECT sources_json
     FROM entities
     WHERE lower(name) = lower($1)
     ORDER BY CASE kind WHEN 'document' THEN 0 ELSE 1 END, datetime(last_seen_at) DESC
     LIMIT 5`,
    [name],
  );

  for (const row of rows) {
    try {
      const sources = JSON.parse(row.sources_json) as EntitySource[];
      const vaultSource = sources.find((source) => source.integration === 'vault');
      if (vaultSource?.externalId) {
        return vaultSource.externalId;
      }
    } catch {
      continue;
    }
  }

  return null;
};

export const runDailySynthesis = async (userId: string): Promise<{ summary: string }> => {
  const recentEntities = await createMemoryStore().recentEntities(5);
  const summary =
    recentEntities.length === 0
      ? `No recent entities available for ${userId}.`
      : `Recent entities for ${userId}: ${recentEntities.map((entity) => entity.name).join(', ')}`;

  return { summary };
};
