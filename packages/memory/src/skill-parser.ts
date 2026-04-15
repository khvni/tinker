import type { Skill, SkillDraft, SkillFrontmatter } from '@tinker/shared-types';
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
};

export const parseSkillFile = (text: string, fallbackSlug: string): ParsedSkillFile => {
  const { frontmatter: rawFrontmatter, body } = parseFrontmatter(text);
  const declaredName = readString(rawFrontmatter.name);
  const description = readString(rawFrontmatter.description) ?? '';
  const tools = readStringArray(rawFrontmatter.tools);
  const tags = readStringArray(rawFrontmatter.tags);
  const headingMatch = body.match(H1_PATTERN);
  const heading = headingMatch?.[1]?.trim();

  const candidateSlug = declaredName && isValidSkillSlug(declaredName) ? declaredName : slugify(declaredName ?? fallbackSlug);
  const slug = isValidSkillSlug(candidateSlug) ? candidateSlug : slugify(fallbackSlug);
  const title = heading && heading.length > 0 ? heading : (declaredName ?? slug);

  const frontmatter: SkillFrontmatter = {
    ...rawFrontmatter,
    name: slug,
    description,
    ...(tools.length > 0 ? { tools } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };

  return { frontmatter, body, slug, title, description, tools, tags };
};

export const serializeSkill = (frontmatter: SkillFrontmatter, body: string): string => {
  return serializeFrontmatter({ ...frontmatter }, body);
};

export const draftToSkillContent = (draft: SkillDraft): { frontmatter: SkillFrontmatter; body: string; slug: string } => {
  const slug = isValidSkillSlug(draft.slug) ? draft.slug : slugify(draft.slug);
  const frontmatter: SkillFrontmatter = {
    name: slug,
    description: draft.description.trim(),
    ...(draft.tools && draft.tools.length > 0 ? { tools: draft.tools } : {}),
    ...(draft.tags && draft.tags.length > 0 ? { tags: draft.tags } : {}),
  };

  return { frontmatter, body: draft.body.trim().length > 0 ? draft.body : `# ${slug}\n\n`, slug };
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
