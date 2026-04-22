import type { Entity, EntityKind, EntitySource } from '@tinker/shared-types';

export const MANAGED_MEMORY_HEADING = '## Tinker Memory';

const ENTITY_KIND_BY_FOLDER = {
  people: 'person',
  person: 'person',
  projects: 'project',
  project: 'project',
  documents: 'document',
  document: 'document',
  docs: 'document',
  channels: 'channel',
  channel: 'channel',
  tickets: 'ticket',
  ticket: 'ticket',
  accounts: 'account',
  account: 'account',
  concepts: 'concept',
  concept: 'concept',
  organizations: 'organization',
  organization: 'organization',
  orgs: 'organization',
  tools: 'tool',
  tool: 'tool',
  events: 'event',
  event: 'event',
} as const satisfies Record<string, EntityKind>;

type EntityFolderKey = keyof typeof ENTITY_KIND_BY_FOLDER;

const ENTITY_DIRECTORY_BY_KIND: Record<EntityKind, string> = {
  person: 'People',
  project: 'Projects',
  document: 'Documents',
  channel: 'Channels',
  ticket: 'Tickets',
  account: 'Accounts',
  other: 'Concepts',
  concept: 'Concepts',
  organization: 'Organizations',
  tool: 'Tools',
  event: 'Events',
};

export const isEntityKind = (value: unknown): value is EntityKind => {
  return typeof value === 'string' && value in ENTITY_DIRECTORY_BY_KIND;
};

export const directoryForEntityKind = (kind: EntityKind): string => {
  return ENTITY_DIRECTORY_BY_KIND[kind];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const inferEntityKindFromNote = (relativePath: string, frontmatter: Record<string, unknown>): EntityKind => {
  if (isEntityKind(frontmatter.type)) {
    return frontmatter.type;
  }

  const [firstSegment] = relativePath.split('/');
  if (!firstSegment) {
    return 'document';
  }

  const folder = firstSegment.toLowerCase();
  return (folder in ENTITY_KIND_BY_FOLDER ? ENTITY_KIND_BY_FOLDER[folder as EntityFolderKey] : undefined) ?? 'document';
};

export const collectWikilinks = (text: string): string[] => {
  const links = new Set<string>();

  for (const match of text.matchAll(/\[\[([^[\]]+)\]\]/gu)) {
    const target = match[1]?.trim();
    if (target) {
      links.add(target);
    }
  }

  return Array.from(links);
};

export const stripMarkdown = (text: string): string => {
  return text
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(/`{1,3}[^`]*`{1,3}/gu, ' ')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/\[\[([^[\]]+)\]\]/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[*_>~-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
};

export const buildPreview = (text: string, limit = 320): string => {
  const stripped = stripMarkdown(text);
  if (stripped.length <= limit) {
    return stripped;
  }

  return `${stripped.slice(0, limit - 1).trimEnd()}…`;
};

export const sanitizeEntityFileName = (name: string): string => {
  const trimmed = name.trim().replace(/\s+/gu, ' ');
  const sanitized = trimmed.replace(/[\\/:*?"<>|]/gu, '-').replace(/[. ]+$/u, '').trim();
  return sanitized.length > 0 ? sanitized : 'Untitled';
};

export const normalizeFactText = (value: string): string => {
  return value.trim().replace(/\s+/gu, ' ');
};

export const normalizeEntitySource = (value: unknown, fallbackLastSeen: string): EntitySource | null => {
  if (!isRecord(value)) {
    return null;
  }

  const service = typeof value.service === 'string'
    ? value.service.trim()
    : typeof value.integration === 'string'
      ? value.integration.trim()
      : '';
  const ref = typeof value.ref === 'string'
    ? value.ref.trim()
    : typeof value.externalId === 'string'
      ? value.externalId.trim()
      : '';
  const lastSeen = typeof value.lastSeen === 'string' && value.lastSeen.trim().length > 0
    ? value.lastSeen.trim()
    : fallbackLastSeen;

  if (service.length === 0 || ref.length === 0 || lastSeen.length === 0) {
    return null;
  }

  return {
    service,
    ref,
    lastSeen,
    ...(typeof value.url === 'string' && value.url.trim().length > 0 ? { url: value.url.trim() } : {}),
  };
};

export const normalizeEntitySources = (value: unknown, fallbackLastSeen: string): EntitySource[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: EntitySource[] = [];

  for (const item of value) {
    const source = normalizeEntitySource(item, fallbackLastSeen);
    if (!source) {
      continue;
    }

    const key = `${source.service}:${source.ref}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(source);
  }

  return normalized;
};

export const mergeEntitySources = (
  frontmatter: Record<string, unknown>,
  nextSources: EntitySource[] | undefined,
  fallbackLastSeen: string,
): Record<string, unknown> => {
  const currentSources = normalizeEntitySources(frontmatter.sources, fallbackLastSeen);
  const mergedSources = Array.from(
    new Map(
      [...currentSources, ...(nextSources ?? [])].map((source) => [`${source.service}:${source.ref}`, source] as const),
    ).values(),
  );

  const currentSignature = JSON.stringify(currentSources);
  const mergedSignature = JSON.stringify(mergedSources);
  if (currentSignature === mergedSignature) {
    return frontmatter;
  }

  if (mergedSources.length === 0) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, 'sources')) {
      return frontmatter;
    }

    const { sources: _sources, ...rest } = frontmatter;
    return rest;
  }

  return { ...frontmatter, sources: mergedSources };
};

export const readManagedFactTexts = (body: string): Set<string> => {
  const headingIndex = body.indexOf(MANAGED_MEMORY_HEADING);
  if (headingIndex < 0) {
    return new Set<string>();
  }

  const afterHeading = body.slice(headingIndex + MANAGED_MEMORY_HEADING.length);
  const nextHeadingMatch = afterHeading.match(/\n##\s|\n#\s/u);
  const section =
    nextHeadingMatch && typeof nextHeadingMatch.index === 'number'
      ? afterHeading.slice(0, nextHeadingMatch.index)
      : afterHeading;

  const facts = new Set<string>();
  for (const line of section.split('\n')) {
    const match = line.match(/^\s*-\s+\[(?<date>[^\]]+)\]\s+(?<fact>.+)$/u);
    const fact = match?.groups?.fact;
    if (fact) {
      facts.add(normalizeFactText(fact));
    }
  }

  return facts;
};

export const appendManagedFacts = (
  body: string,
  facts: Array<{ date: string; text: string }>,
): { body: string; appended: number } => {
  const normalizedFacts = facts
    .map((fact) => ({
      date: fact.date,
      text: normalizeFactText(fact.text),
    }))
    .filter((fact) => fact.text.length > 0);

  if (normalizedFacts.length === 0) {
    return { body, appended: 0 };
  }

  const existingFactTexts = readManagedFactTexts(body);
  const freshLines = normalizedFacts
    .filter((fact) => !existingFactTexts.has(fact.text))
    .map((fact) => `- [${fact.date}] ${fact.text}`);

  if (freshLines.length === 0) {
    return { body, appended: 0 };
  }

  const normalizedBody = body.trimEnd();
  const headingIndex = normalizedBody.indexOf(MANAGED_MEMORY_HEADING);

  if (headingIndex < 0) {
    const prefix = normalizedBody.length > 0 ? `${normalizedBody}\n\n` : '';
    return {
      body: `${prefix}${MANAGED_MEMORY_HEADING}\n${freshLines.join('\n')}\n`,
      appended: freshLines.length,
    };
  }

  const insertStart = headingIndex + MANAGED_MEMORY_HEADING.length;
  const afterHeading = normalizedBody.slice(insertStart);
  const nextHeadingMatch = afterHeading.match(/\n##\s|\n#\s/u);
  const sectionEnd =
    nextHeadingMatch && typeof nextHeadingMatch.index === 'number'
      ? insertStart + nextHeadingMatch.index
      : normalizedBody.length;

  const beforeSectionTail = normalizedBody.slice(0, sectionEnd).replace(/\s*$/u, '');
  const afterSection = normalizedBody.slice(sectionEnd);
  return {
    body: `${beforeSectionTail}\n${freshLines.join('\n')}${afterSection.length > 0 ? afterSection : '\n'}`,
    appended: freshLines.length,
  };
};

export const readEntityAliases = (frontmatter: Record<string, unknown>): string[] => {
  const aliases = frontmatter.aliases;
  if (!Array.isArray(aliases)) {
    return [];
  }

  return aliases
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item, index, values) => item.length > 0 && values.indexOf(item) === index);
};

export const readEntitySources = (
  frontmatter: Record<string, unknown>,
  relativePath: string,
  lastSeen: string,
): Entity['sources'] => {
  if (Object.prototype.hasOwnProperty.call(frontmatter, 'sources')) {
    return normalizeEntitySources(frontmatter.sources, lastSeen);
  }

  return createVaultEntitySource(relativePath, lastSeen);
};

export const createVaultEntitySource = (relativePath: string, lastSeen = new Date().toISOString()): Entity['sources'] => {
  return [{ service: 'vault', ref: relativePath, lastSeen }];
};
