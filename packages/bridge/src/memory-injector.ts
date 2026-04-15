import type { OpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { Entity } from '@tinker/shared-types';
import type { EntitySource } from '@tinker/shared-types/memory';

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const entitySummary = (entity: Entity): string => {
  const aliases = entity.aliases.length > 0 ? ` aliases=${entity.aliases.join(', ')}` : '';
  const sources = entity.sources
    .map((source: EntitySource) => `${source.integration}:${source.externalId}`)
    .join(', ');
  const relativePath =
    typeof entity.attributes.relativePath === 'string' && entity.attributes.relativePath.length > 0
      ? ` path=${entity.attributes.relativePath}`
      : '';
  const excerpt =
    typeof entity.attributes.excerpt === 'string' && entity.attributes.excerpt.length > 0
      ? `\n  excerpt: ${entity.attributes.excerpt}`
      : '';
  const links = readStringArray(entity.attributes.links);
  const linkSummary = links.length > 0 ? `\n  links: ${links.map((link) => `[[${link}]]`).join(', ')}` : '';

  return `- ${entity.name} [${entity.kind}]${aliases}${relativePath}${sources ? ` sources=${sources}` : ''}${excerpt}${linkSummary}`;
};

export const buildMemoryContext = (entities: Entity[]): string | null => {
  if (entities.length === 0) {
    return null;
  }

  return ['Relevant local memory:', ...entities.map(entitySummary)].join('\n');
};

export const injectMemoryContext = async (
  client: Pick<OpencodeClient, 'session'>,
  sessionID: string,
  entities: Entity[],
): Promise<void> => {
  const text = buildMemoryContext(entities);

  if (!text) {
    return;
  }

  await client.session.prompt({
    sessionID,
    noReply: true,
    parts: [{ type: 'text', text }],
  });
};
