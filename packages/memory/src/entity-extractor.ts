import type { Entity } from '@tinker/shared-types';
import { createVaultEntitySource } from './memory-utils.js';

const encodeEntityKey = (value: string): string => encodeURIComponent(value.toLowerCase());

const createEntityId = (kind: Entity['kind'], source: string, name: string): string => {
  return `vault:${encodeEntityKey(source)}#${kind}:${encodeEntityKey(name)}`;
};

const createEntity = (
  kind: Entity['kind'],
  source: string,
  name: string,
  lastSeenAt: string,
  description?: string,
): Entity => {
  return {
    id: createEntityId(kind, source, name),
    kind,
    name,
    aliases: [],
    sources: createVaultEntitySource(source, lastSeenAt),
    attributes: description ? { description } : {},
    lastSeenAt,
  };
};

const normalizeDescription = (value: string): string | undefined => {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length > 0 ? normalized : undefined;
};

const PREFIX_KIND_BY_LABEL = {
  PROJECT: 'project',
  TICKET: 'ticket',
  ORG: 'organization',
  TOOL: 'tool',
  CHANNEL: 'channel',
  ACCOUNT: 'account',
  EVENT: 'event',
  DOC: 'document',
  CONCEPT: 'concept',
} as const satisfies Record<string, Entity['kind']>;

export const extractEntities = (text: string, source: string, observedAt = new Date().toISOString()): Entity[] => {
  const entities = new Map<string, Entity>();

  const addEntity = (kind: Entity['kind'], rawName: string, description?: string): void => {
    const name = rawName.trim();
    if (name.length === 0) {
      return;
    }

    const id = createEntityId(kind, source, name);
    if (!entities.has(id)) {
      entities.set(id, createEntity(kind, source, name, observedAt, description));
      return;
    }

    const existing = entities.get(id);
    if (!existing || typeof existing.attributes.description === 'string' || !description) {
      return;
    }

    entities.set(id, {
      ...existing,
      attributes: { ...existing.attributes, description },
      lastSeenAt: observedAt,
    });
  };

  for (const line of text.split('\n')) {
    const description = normalizeDescription(line);

    for (const match of line.matchAll(/(^|\s)@([A-Za-z0-9._-]+)/gu)) {
      const mention = match[2];
      if (mention) {
        addEntity('person', mention, description);
      }
    }

    for (const match of line.matchAll(/\[\[([^[\]]+)\]\]/gu)) {
      const link = match[1];
      if (link) {
        addEntity('document', link, description);
      }
    }

    for (const [label, kind] of Object.entries(PREFIX_KIND_BY_LABEL)) {
      if (!line.startsWith(`${label}:`)) {
        continue;
      }

      addEntity(kind, line.slice(label.length + 1), description);
    }
  }

  return Array.from(entities.values());
};
