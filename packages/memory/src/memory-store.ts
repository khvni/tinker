import { readTextFile } from '@tauri-apps/plugin-fs';
import type { Entity, EntitySource, MemorySearchResult, MemoryStore, Relationship } from '@tinker/shared-types';
import type { VaultConfig } from '@tinker/shared-types/vault';
import { getDatabase } from './database.js';
import { extractEntities } from './entity-extractor.js';
import {
  buildPreview,
  collectWikilinks,
  inferEntityKindFromNote,
  normalizeEntitySources,
  readEntityAliases,
  readEntitySources,
} from './memory-utils.js';
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

type RelationshipRow = {
  subject_id: string;
  predicate: string;
  object_id: string;
  confidence: number;
  source: string | null;
  sources_json: string;
};

type IndexedNote = {
  entity: Entity;
  body: string;
  links: string[];
};

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getEntityRelativePath = (entity: Entity): string | null => {
  const relativePath = entity.attributes.relativePath;
  return typeof relativePath === 'string' && relativePath.length > 0 ? relativePath : null;
};

const isVaultBackedEntity = (entity: Entity): boolean => {
  return getEntityRelativePath(entity) !== null || entity.sources.some((source) => source.service === 'vault');
};

const parseLegacyRelationshipSource = (value: string | null | undefined): EntitySource[] => {
  if (!value) {
    return [];
  }

  const separatorIndex = value.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return [];
  }

  return [{
    service: value.slice(0, separatorIndex),
    ref: value.slice(separatorIndex + 1),
    lastSeen: new Date().toISOString(),
  }];
};

const readRelationshipSources = (row: RelationshipRow): EntitySource[] => {
  const normalized = normalizeEntitySources(parseJson(row.sources_json, []), new Date().toISOString());
  return normalized.length > 0 ? normalized : parseLegacyRelationshipSource(row.source);
};

const normalizeSearchContent = (entity: Entity): string => {
  const description = typeof entity.attributes.description === 'string' ? entity.attributes.description : '';
  const preview = typeof entity.attributes.preview === 'string' ? entity.attributes.preview : '';
  const excerpt = typeof entity.attributes.excerpt === 'string' ? entity.attributes.excerpt : '';
  const relativePath = typeof entity.attributes.relativePath === 'string' ? entity.attributes.relativePath : '';
  const links = Array.isArray(entity.attributes.links)
    ? entity.attributes.links.filter((value): value is string => typeof value === 'string')
    : [];

  return [entity.aliases.join(' '), description, preview, excerpt, relativePath, links.join(' ')].filter(Boolean).join(' ');
};

const hydrateEntity = (row: EntityRow): Entity => {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    aliases: parseJson(row.aliases_json, []),
    sources: normalizeEntitySources(parseJson(row.sources_json, []), row.last_seen_at),
    attributes: parseJson(row.attributes_json, {}),
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
  const rows = await database.select<EntityRow[]>(
    `SELECT id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at
     FROM entities`,
  );

  return rows.map(hydrateEntity).filter(isVaultBackedEntity).map((row) => row.id);
};

const clearVaultRelationships = async (database: Awaited<ReturnType<typeof getDatabase>>): Promise<void> => {
  await database.execute(
    `DELETE FROM relationships
     WHERE source LIKE 'vault:%'
        OR sources_json LIKE '%"service":"vault"%'`,
  );
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
    aliases: readEntityAliases(frontmatter),
    kind: inferEntityKindFromNote(relativePath, frontmatter),
    name: title,
    sources: readEntitySources(frontmatter, relativePath, new Date().toISOString()),
    attributes: {
      frontmatter,
      description:
        typeof frontmatter.description === 'string' && frontmatter.description.trim().length > 0
          ? frontmatter.description.trim()
          : buildPreview(body, 160),
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
      const normalizedSources = normalizeEntitySources(entity.sources, entity.lastSeenAt);

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
          JSON.stringify(normalizedSources),
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
      const primarySource = rel.sources[0];
      const legacySource = primarySource ? `${primarySource.service}:${primarySource.ref}` : '';

      await database.execute(
        `INSERT INTO relationships (subject_id, predicate, object_id, confidence, source, sources_json)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(subject_id, predicate, object_id) DO UPDATE SET
           confidence = excluded.confidence,
           source = excluded.source,
           sources_json = excluded.sources_json`,
        [
          rel.subjectId,
          rel.predicate,
          rel.objectId,
          rel.confidence,
          legacySource,
          JSON.stringify(rel.sources),
        ],
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

      const extractedEntities = extractEntities(note.body, note.entity.id, note.entity.lastSeenAt);
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
              sources: [{
                service: 'vault',
                ref: note.entity.attributes.relativePath as string,
                lastSeen: note.entity.lastSeenAt,
              }],
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
  const seedSelect = seedIds.map((_, index) => `SELECT $${index + 1} AS id`).join(' UNION ALL ');
  const relatedRows = await database.select<Array<{ id: string }>>(
    `WITH RECURSIVE
       seed(id) AS (${seedSelect}),
       graph(id, depth) AS (
         SELECT id, 0 FROM seed
         UNION
         SELECT
           CASE
             WHEN relationships.subject_id = graph.id THEN relationships.object_id
             ELSE relationships.subject_id
           END AS id,
           graph.depth + 1
         FROM relationships
         JOIN graph
           ON relationships.subject_id = graph.id
           OR relationships.object_id = graph.id
         WHERE graph.depth < 1
       )
     SELECT DISTINCT id
     FROM graph
     WHERE depth > 0
     LIMIT $${seedIds.length + 1}`,
    [...seedIds, limit * 4],
  );

  const relatedIds = relatedRows
    .map((row) => row.id)
    .filter((id, index, ids) => !seedIds.includes(id) && ids.indexOf(id) === index)
    .slice(0, limit);

  const relatedEntities = await selectEntitiesByIds(relatedIds);
  const deduped = new Map<string, Entity>();
  for (const entity of [...seedEntities, ...relatedEntities]) {
    deduped.set(entity.id, entity);
  }

  return Array.from(deduped.values()).slice(0, limit);
};

export const findVaultNotePathByEntityName = async (name: string): Promise<string | null> => {
  const database = await getDatabase();
  const rows = await database.select<Array<{ attributes_json: string; sources_json: string; last_seen_at: string }>>(
    `SELECT attributes_json, sources_json, last_seen_at
     FROM entities
     WHERE lower(name) = lower($1)
     ORDER BY CASE kind WHEN 'document' THEN 0 ELSE 1 END, datetime(last_seen_at) DESC
     LIMIT 5`,
    [name],
  );

  for (const row of rows) {
    const attributes = parseJson<Record<string, unknown>>(row.attributes_json, {});
    const relativePath = typeof attributes.relativePath === 'string' ? attributes.relativePath : null;
    if (relativePath) {
      return relativePath;
    }

    const sources = normalizeEntitySources(parseJson(row.sources_json, []), row.last_seen_at);
    const vaultSource = sources.find((source) => source.service === 'vault');
    if (vaultSource?.ref) {
      return vaultSource.ref;
    }
  }

  return null;
};

export const pruneEntitiesWithoutSources = async (): Promise<number> => {
  const database = await getDatabase();
  const rows = await database.select<EntityRow[]>(
    `SELECT id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at
     FROM entities`,
  );

  const staleIds = rows
    .map(hydrateEntity)
    .filter((entity) => entity.sources.length === 0)
    .map((entity) => entity.id);

  await Promise.all(staleIds.map((id) => deleteEntityRecord(database, id)));
  return staleIds.length;
};

export const wipeMemorySource = async (service: string): Promise<{ entities: number; relationships: number }> => {
  const memoryStore = createMemoryStore();
  const database = await getDatabase();
  const normalizedService = service.trim();

  if (normalizedService.length === 0) {
    return { entities: 0, relationships: 0 };
  }

  const entityRows = await database.select<EntityRow[]>(
    `SELECT id, kind, name, aliases_json, sources_json, attributes_json, last_seen_at
     FROM entities`,
  );
  let entityChanges = 0;

  for (const entity of entityRows.map(hydrateEntity)) {
    const nextSources = entity.sources.filter((source) => source.service !== normalizedService);
    if (nextSources.length === entity.sources.length) {
      continue;
    }

    entityChanges += 1;
    if (nextSources.length === 0) {
      await deleteEntityRecord(database, entity.id);
      continue;
    }

    await memoryStore.upsertEntity({
      ...entity,
      sources: nextSources,
    });
  }

  const relationshipRows = await database.select<RelationshipRow[]>(
    `SELECT subject_id, predicate, object_id, confidence, source, sources_json
     FROM relationships`,
  );
  let relationshipChanges = 0;

  for (const row of relationshipRows) {
    const currentSources = readRelationshipSources(row);
    const nextSources = currentSources.filter((source) => source.service !== normalizedService);
    if (nextSources.length === currentSources.length) {
      continue;
    }

    relationshipChanges += 1;
    if (nextSources.length === 0) {
      await database.execute(
        `DELETE FROM relationships
         WHERE subject_id = $1 AND predicate = $2 AND object_id = $3`,
        [row.subject_id, row.predicate, row.object_id],
      );
      continue;
    }

    const primarySource = nextSources[0];
    await database.execute(
      `UPDATE relationships
       SET source = $4,
           sources_json = $5
       WHERE subject_id = $1 AND predicate = $2 AND object_id = $3`,
      [
        row.subject_id,
        row.predicate,
        row.object_id,
        primarySource ? `${primarySource.service}:${primarySource.ref}` : '',
        JSON.stringify(nextSources),
      ],
    );
  }

  await pruneEntitiesWithoutSources();
  return { entities: entityChanges, relationships: relationshipChanges };
};

export const runMemoryMaintenanceSweep = async (vault: VaultConfig): Promise<{ entitiesIndexed: number; entitiesPruned: number }> => {
  const { entitiesIndexed } = await indexVault(vault);
  const entitiesPruned = await pruneEntitiesWithoutSources();
  return { entitiesIndexed, entitiesPruned };
};
