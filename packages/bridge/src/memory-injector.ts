import type { OpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { Entity } from '@tinker/shared-types';

const entitySummary = (entity: Entity): string => {
  const { attributes } = entity;
  const aliases = entity.aliases.length > 0 ? ` aliases=${entity.aliases.join(', ')}` : '';
  const sources = entity.sources.map((source) => `${source.service}:${source.ref}`).join(', ');
  const relativePath =
    typeof attributes.relativePath === 'string' && attributes.relativePath.length > 0
      ? ` path=${attributes.relativePath}`
      : '';
  const excerpt =
    typeof attributes.excerpt === 'string' && attributes.excerpt.length > 0
      ? `\n  excerpt: ${attributes.excerpt}`
      : '';
  const links = Array.isArray(attributes.links)
    ? attributes.links.filter((item): item is string => typeof item === 'string')
    : [];
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
