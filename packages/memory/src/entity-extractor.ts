import type { Entity } from '@tinker/shared-types';

const createEntityId = (kind: Entity['kind'], source: string, name: string): string => {
  const normalizedSource = source.toLowerCase().replace(/[^\w/-]+/gu, '-');
  const normalizedName = name.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/gu, '-').replace(/^-|-$/gu, '');
  return `vault:${normalizedSource}#${kind}:${normalizedName}`;
};

const createEntity = (kind: Entity['kind'], source: string, name: string): Entity => {
  return {
    id: createEntityId(kind, source, name),
    kind,
    name,
    aliases: [],
    sources: [{ integration: 'vault', externalId: source }],
    attributes: {
      extractedFrom: source,
      heuristic: true,
    },
    lastSeenAt: new Date().toISOString(),
  };
};

export const extractEntities = (text: string, source: string): Entity[] => {
  const entities = new Map<string, Entity>();

  const addEntity = (kind: Entity['kind'], rawName: string): void => {
    const name = rawName.trim();
    if (name.length === 0) {
      return;
    }

    const id = createEntityId(kind, source, name);
    if (!entities.has(id)) {
      entities.set(id, createEntity(kind, source, name));
    }
  };

  for (const match of text.matchAll(/(^|\s)@([A-Za-z0-9._-]+)/gu)) {
    const mention = match[2];
    if (mention) {
      addEntity('person', mention);
    }
  }

  for (const match of text.matchAll(/\[\[([^[\]]+)\]\]/gu)) {
    const link = match[1];
    if (link) {
      addEntity('document', link);
    }
  }

  const titleMatch = text.match(/^#\s+(.+)$/mu);
  if (titleMatch?.[1]) {
    addEntity('document', titleMatch[1]);
  }

  for (const line of text.split('\n')) {
    if (line.startsWith('PROJECT:')) {
      addEntity('project', line.slice('PROJECT:'.length));
    }

    if (line.startsWith('TICKET:')) {
      addEntity('ticket', line.slice('TICKET:'.length));
    }
  }

  return Array.from(entities.values());
};
