import type { Skill, SkillDraft, SkillFrontmatter } from '@tinker/shared-types';
import { DEFAULT_SKILL_VERSION, SKILLS_VAULT_DIRECTORY } from '@tinker/shared-types';
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

const readHeading = (body: string): string | null => {
  return body.match(H1_PATTERN)?.[1]?.trim() ?? null;
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
  id: string;
  slug: string;
  title: string;
  role: string | null;
  description: string;
  tools: string[];
  tags: string[];
  version: string;
  author: string | null;
};

export const parseSkillFile = (text: string, fallbackSlug: string): ParsedSkillFile => {
  const { frontmatter: rawFrontmatter, body } = parseFrontmatter(text);
  const declaredId = readString(rawFrontmatter.id) ?? readString(rawFrontmatter.name);
  const declaredTitle = readString(rawFrontmatter.title);
  const role = readString(rawFrontmatter.role);
  const description = readString(rawFrontmatter.description) ?? '';
  const tools = readStringArray(rawFrontmatter.tools);
  const tags = readStringArray(rawFrontmatter.tags);
  const version = readString(rawFrontmatter.version) ?? DEFAULT_SKILL_VERSION;
  const author = readString(rawFrontmatter.author);
  const heading = readHeading(body);

  const candidateSlug = declaredId && isValidSkillSlug(declaredId) ? declaredId : slugify(declaredId ?? fallbackSlug);
  const slug = isValidSkillSlug(candidateSlug) ? candidateSlug : slugify(fallbackSlug);
  const title = declaredTitle ?? heading ?? declaredId ?? slug;

  const {
    id: _rawId,
    name: _legacyName,
    title: _rawTitle,
    role: _rawRole,
    tools: _rawTools,
    version: _rawVersion,
    author: _rawAuthor,
    description: _rawDescription,
    tags: _rawTags,
    ...frontmatterRest
  } = rawFrontmatter;

  const frontmatter: SkillFrontmatter = {
    ...frontmatterRest,
    id: slug,
    title,
    ...(role ? { role } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    version,
    ...(author ? { author } : {}),
    ...(description.length > 0 ? { description } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };

  return {
    frontmatter,
    body,
    id: slug,
    slug,
    title,
    role,
    description,
    tools,
    tags,
    version,
    author,
  };
};

export const serializeSkill = (frontmatter: SkillFrontmatter, body: string): string => {
  return serializeFrontmatter({ ...frontmatter }, body);
};

export const draftToSkillContent = (draft: SkillDraft): { frontmatter: SkillFrontmatter; body: string; slug: string } => {
  const slug = isValidSkillSlug(draft.slug) ? draft.slug : slugify(draft.slug);
  const title = readString(draft.title) ?? readHeading(draft.body) ?? readString(draft.slug) ?? slug;
  const role = readString(draft.role);
  const description = draft.description.trim();
  const tools = readStringArray(draft.tools);
  const tags = readStringArray(draft.tags);
  const version = readString(draft.version) ?? DEFAULT_SKILL_VERSION;
  const author = readString(draft.author);
  const frontmatter: SkillFrontmatter = {
    id: slug,
    title,
    ...(role ? { role } : {}),
    ...(description.length > 0 ? { description } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    version,
    ...(author ? { author } : {}),
  };

  return { frontmatter, body: draft.body.trim().length > 0 ? draft.body : `# ${title}\n\n`, slug };
};

export const toPersistedSkill = (
  parsed: ParsedSkillFile,
  relativePath: string,
  lastModified: string,
  active: boolean,
  installedAt: string,
): Skill => {
  return {
    id: parsed.id,
    slug: parsed.slug,
    title: parsed.title,
    role: parsed.role,
    description: parsed.description,
    tools: parsed.tools,
    tags: parsed.tags,
    version: parsed.version,
    author: parsed.author,
    body: parsed.body,
    relativePath,
    frontmatter: parsed.frontmatter,
    lastModified,
    active,
    installedAt,
  };
};
