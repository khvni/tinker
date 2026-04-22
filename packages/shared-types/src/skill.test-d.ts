import { DEFAULT_SKILL_VERSION, type Skill, type SkillDefinition, type SkillDraft, type SkillFrontmatter } from './skill.js';

const _frontmatter: SkillFrontmatter = {
  id: 'gong-call-analysis',
  title: 'Gong Call Analysis',
  role: 'sales',
  tools: ['gmail'],
  version: DEFAULT_SKILL_VERSION,
  author: 'byalikhani',
  description: 'Analyze Gong transcripts.',
  tags: ['sales'],
};

const _definition: SkillDefinition = {
  id: 'gong-call-analysis',
  title: 'Gong Call Analysis',
  role: 'sales',
  tools: ['gmail'],
  version: DEFAULT_SKILL_VERSION,
  author: 'byalikhani',
  body: '# Gong Call Analysis\n\nUse carefully.\n',
};

const _skill: Skill = {
  ..._definition,
  slug: 'gong-call-analysis',
  description: 'Analyze Gong transcripts.',
  tags: ['sales'],
  relativePath: '.tinker/skills/gong-call-analysis.md',
  frontmatter: _frontmatter,
  lastModified: '2026-04-22T00:00:00.000Z',
  active: false,
  installedAt: '2026-04-22T00:00:00.000Z',
};

const _draft: SkillDraft = {
  slug: 'gong-call-analysis',
  title: 'Gong Call Analysis',
  role: 'sales',
  description: 'Analyze Gong transcripts.',
  body: '# Gong Call Analysis\n\nUse carefully.\n',
  tools: ['gmail'],
  tags: ['sales'],
  version: DEFAULT_SKILL_VERSION,
  author: 'byalikhani',
};

const _legacyCompatibleFrontmatter: SkillFrontmatter = {
  id: 'legacy-skill',
  title: 'Legacy Skill',
  name: 'legacy-skill',
  description: 'Legacy description',
  tags: ['legacy'],
};

void _frontmatter;
void _definition;
void _skill;
void _draft;
void _legacyCompatibleFrontmatter;

export {};
