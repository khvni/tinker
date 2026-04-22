import type { Skill, SkillAuthor, SkillDraft, SkillFrontmatter, SkillSpec, SkillSpecFrontmatter } from '@tinker/shared-types';
import { SKILLS_VAULT_DIRECTORY } from '@tinker/shared-types';
import { parseFrontmatter, serializeFrontmatter } from './vault-utils.js';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const H1_PATTERN = /^#\s+(.+)$/mu;

export const slugify = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized.length > 0 ? normalized : 'skill';
};

export const isValidSkillSlug = (value: string): boolean => {
  return SLUG_PATTERN.test(value);
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const readString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const readVersion = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  return readString(value);
};

const readSkillAuthor = (value: unknown): SkillAuthor | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return { name: value.trim() };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const name = readString(candidate.name);

  if (!name) {
    return null;
  }

  const email = readString(candidate.email);
  const url = readString(candidate.url);

  return {
    name,
    ...(email ? { email } : {}),
    ...(url ? { url } : {}),
  };
};

const buildSkillSpecFrontmatter = (
  rawFrontmatter: Record<string, unknown>,
  slug: string,
  title: string,
  tools: string[],
): SkillSpecFrontmatter => {
  const author = readSkillAuthor(rawFrontmatter.author);
  const role = readString(rawFrontmatter.role) ?? 'assistant';
  const version = readVersion(rawFrontmatter.version) ?? '1';

  return {
    id: slug,
    title,
    role,
    ...(tools.length > 0 ? { tools } : {}),
    version,
    ...(author ? { author } : {}),
  };
};

export const skillRelativePath = (slug: string): string => {
  return `${SKILLS_VAULT_DIRECTORY}/${slug}.md`;
};

export const isSkillRelativePath = (relativePath: string): boolean => {
  return relativePath.startsWith(`${SKILLS_VAULT_DIRECTORY}/`) && relativePath.toLowerCase().endsWith('.md');
};

export const slugFromRelativePath = (relativePath: string): string => {
  const withoutPrefix = relativePath.startsWith(`${SKILLS_VAULT_DIRECTORY}/`)
    ? relativePath.slice(SKILLS_VAULT_DIRECTORY.length + 1)
    : relativePath;
  const withoutExt = withoutPrefix.replace(/\.md$/iu, '');
  return withoutExt.split('/').pop() ?? withoutExt;
};

export type ParsedSkillFile = {
  frontmatter: SkillFrontmatter;
  body: string;
  slug: string;
  title: string;
  description: string;
  tools: string[];
  tags: string[];
  spec: SkillSpec;
};

export const parseSkillFile = (text: string, fallbackSlug: string): ParsedSkillFile => {
  const { frontmatter: rawFrontmatter, body } = parseFrontmatter(text);
  const declaredName = readString(rawFrontmatter.name);
  const declaredId = readString(rawFrontmatter.id);
  const description = readString(rawFrontmatter.description) ?? '';
  const tools = readStringArray(rawFrontmatter.tools);
  const tags = readStringArray(rawFrontmatter.tags);
  const headingMatch = body.match(H1_PATTERN);
  const heading = headingMatch?.[1]?.trim();

  const slugSource = declaredId ?? declaredName ?? fallbackSlug;
  const candidateSlug = isValidSkillSlug(slugSource) ? slugSource : slugify(slugSource);
  const slug = isValidSkillSlug(candidateSlug) ? candidateSlug : slugify(fallbackSlug);
  const title = readString(rawFrontmatter.title) ?? heading ?? declaredName ?? slug;
  const specFrontmatter = buildSkillSpecFrontmatter(rawFrontmatter, slug, title, tools);
  const spec: SkillSpec = {
    ...specFrontmatter,
    body,
  };

  const frontmatter: SkillFrontmatter = {
    ...rawFrontmatter,
    name: slug,
    description,
    id: specFrontmatter.id,
    title: specFrontmatter.title,
    role: specFrontmatter.role,
    version: specFrontmatter.version,
    ...(specFrontmatter.author ? { author: specFrontmatter.author } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };

  return { frontmatter, body, slug, title, description, tools, tags, spec };
};

export const serializeSkill = (frontmatter: SkillFrontmatter, body: string): string => {
  return serializeFrontmatter({ ...frontmatter }, body);
};

export const draftToSkillContent = (
  draft: SkillDraft,
): { frontmatter: SkillFrontmatter; body: string; slug: string; spec: SkillSpec } => {
  const slug = isValidSkillSlug(draft.slug) ? draft.slug : slugify(draft.slug);
  const body = draft.body.trim().length > 0 ? draft.body : `# ${draft.title?.trim() || slug}\n\n`;
  const headingMatch = body.match(H1_PATTERN);
  const title = readString(draft.title) ?? headingMatch?.[1]?.trim() ?? slug;
  const author = readSkillAuthor(draft.author);
  const specFrontmatter: SkillSpecFrontmatter = {
    id: slug,
    title,
    role: readString(draft.role) ?? 'assistant',
    ...(draft.tools && draft.tools.length > 0 ? { tools: draft.tools } : {}),
    version: readVersion(draft.version) ?? '1',
    ...(author ? { author } : {}),
  };
  const frontmatter: SkillFrontmatter = {
    ...specFrontmatter,
    name: slug,
    description: draft.description.trim(),
    ...(draft.tools && draft.tools.length > 0 ? { tools: draft.tools } : {}),
    ...(draft.tags && draft.tags.length > 0 ? { tags: draft.tags } : {}),
  };

  return {
    frontmatter,
    body,
    slug,
    spec: {
      ...specFrontmatter,
      body,
    },
  };
};

export const toPersistedSkill = (
  parsed: ParsedSkillFile,
  relativePath: string,
  lastModified: string,
  active: boolean,
  installedAt: string,
): Skill => {
  return {
    slug: parsed.slug,
    title: parsed.title,
    description: parsed.description,
    tools: parsed.tools,
    tags: parsed.tags,
    body: parsed.body,
    relativePath,
    frontmatter: parsed.frontmatter,
    lastModified,
    active,
    installedAt,
  };
};
