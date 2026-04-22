import type { SkillAuthor, SkillDraft, SkillFrontmatter, SkillRole, SkillSpec, SkillSpecFrontmatter } from './skill.js';

const _assistantRole: SkillRole = 'assistant';
const _customRole: SkillRole = 'researcher';

const _author: SkillAuthor = {
  name: 'Tinker',
  email: 'hello@example.com',
  url: 'https://example.com/authors/tinker',
};

const _specFrontmatter: SkillSpecFrontmatter = {
  id: 'gong-call-analysis',
  title: 'Gong Call Analysis',
  role: 'assistant',
  tools: ['gmail'],
  version: '1',
  author: _author,
};

const _spec: SkillSpec = {
  ..._specFrontmatter,
  body: '# Gong Call Analysis\n\nDo the thing.\n',
};

const _legacyFrontmatter: SkillFrontmatter = {
  name: 'gong-call-analysis',
  description: 'Analyze a Gong call transcript.',
  tools: ['gmail'],
  tags: ['sales'],
};

const _hybridFrontmatter: SkillFrontmatter = {
  name: 'gong-call-analysis',
  description: 'Analyze a Gong call transcript.',
  id: 'gong-call-analysis',
  title: 'Gong Call Analysis',
  role: 'assistant',
  version: '1',
  author: _author,
};

const _draft: SkillDraft = {
  slug: 'gong-call-analysis',
  description: 'Analyze a Gong call transcript.',
  body: '# Gong Call Analysis\n\nDo the thing.\n',
  title: 'Gong Call Analysis',
  role: 'assistant',
  version: '1',
  author: _author,
};

// @ts-expect-error `id` is required in the canonical frontmatter spec
const _missingId: SkillSpecFrontmatter = {
  title: 'Missing ID',
  role: 'assistant',
  version: '1',
};

const _badRole: SkillSpecFrontmatter = {
  id: 'bad-role',
  title: 'Bad Role',
  // @ts-expect-error roles must be strings
  role: 1,
  version: '1',
};

const _badAuthor: SkillSpecFrontmatter = {
  id: 'bad-author',
  title: 'Bad Author',
  role: 'assistant',
  version: '1',
  // @ts-expect-error `author.name` is required when author metadata exists
  author: {},
};

void _author;
void _assistantRole;
void _customRole;
void _specFrontmatter;
void _spec;
void _legacyFrontmatter;
void _hybridFrontmatter;
void _draft;
void _missingId;
void _badRole;
void _badAuthor;

export {};
