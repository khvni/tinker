import { describe, expect, it } from 'vitest';
import {
  draftToSkillContent,
  isSkillRelativePath,
  isValidSkillSlug,
  parseSkillFile,
  serializeSkill,
  skillRelativePath,
  slugFromRelativePath,
  slugify,
} from './skill-parser.js';

const skillMarkdown = `---
description: Analyze a Gong call transcript and surface coaching moments.
name: gong-call-analysis
tags:
  - sales
  - calls
tools:
  - gmail
---

# Gong Call Analysis

## When to Use This
After a sales call lands in Gong.

## How to Do It
1. Pull the transcript.
2. Summarize objections.
`;

describe('slugify', () => {
  it('normalizes arbitrary text into kebab-case', () => {
    expect(slugify('Gong Call Analysis!')).toBe('gong-call-analysis');
    expect(slugify('  multiple   spaces  ')).toBe('multiple-spaces');
    expect(slugify('AlreadyKebab-Case')).toBe('alreadykebab-case');
  });

  it('falls back to "skill" when input is empty', () => {
    expect(slugify('')).toBe('skill');
    expect(slugify('###')).toBe('skill');
  });
});

describe('isValidSkillSlug', () => {
  it('accepts lowercase kebab-case slugs', () => {
    expect(isValidSkillSlug('gong-call-analysis')).toBe(true);
    expect(isValidSkillSlug('single')).toBe(true);
  });

  it('rejects invalid slugs', () => {
    expect(isValidSkillSlug('Gong-Call')).toBe(false);
    expect(isValidSkillSlug('-leading')).toBe(false);
    expect(isValidSkillSlug('space slug')).toBe(false);
  });
});

describe('skillRelativePath and slugFromRelativePath', () => {
  it('builds relative paths under .tinker/skills/', () => {
    expect(skillRelativePath('gong-call-analysis')).toBe('.tinker/skills/gong-call-analysis.md');
  });

  it('recovers slug from relative path', () => {
    expect(slugFromRelativePath('.tinker/skills/gong-call-analysis.md')).toBe('gong-call-analysis');
    expect(slugFromRelativePath('my-skill.md')).toBe('my-skill');
  });

  it('identifies skill relative paths', () => {
    expect(isSkillRelativePath('.tinker/skills/foo.md')).toBe(true);
    expect(isSkillRelativePath('.tinker/skills/nested/foo.md')).toBe(true);
    expect(isSkillRelativePath('.tinker/skills/foo.txt')).toBe(false);
    expect(isSkillRelativePath('notes/foo.md')).toBe(false);
  });
});

describe('parseSkillFile', () => {
  it('extracts slug, title, description, tools and tags from frontmatter', () => {
    const parsed = parseSkillFile(skillMarkdown, 'fallback-slug');

    expect(parsed.slug).toBe('gong-call-analysis');
    expect(parsed.title).toBe('Gong Call Analysis');
    expect(parsed.description).toBe('Analyze a Gong call transcript and surface coaching moments.');
    expect(parsed.tools).toEqual(['gmail']);
    expect(parsed.tags).toEqual(['sales', 'calls']);
    expect(parsed.frontmatter.name).toBe('gong-call-analysis');
    expect(parsed.body).toContain('# Gong Call Analysis');
  });

  it('falls back to the supplied slug when frontmatter is missing', () => {
    const parsed = parseSkillFile('Body only, no frontmatter.', 'fallback-slug');

    expect(parsed.slug).toBe('fallback-slug');
    expect(parsed.description).toBe('');
    expect(parsed.tools).toEqual([]);
    expect(parsed.tags).toEqual([]);
  });

  it('slugifies invalid frontmatter names', () => {
    const parsed = parseSkillFile(
      '---\nname: Bad Name!\ndescription: desc\n---\n\n# Title\n',
      'fallback',
    );

    expect(parsed.slug).toBe('bad-name');
    expect(parsed.frontmatter.name).toBe('bad-name');
  });
});

describe('draftToSkillContent', () => {
  it('builds frontmatter + body from a draft', () => {
    const result = draftToSkillContent({
      slug: 'Gong Call Analysis',
      description: ' Analyze call ',
      body: '# Title\n\nStep 1.\n',
      tools: ['gmail'],
      tags: ['sales'],
    });

    expect(result.slug).toBe('gong-call-analysis');
    expect(result.frontmatter.name).toBe('gong-call-analysis');
    expect(result.frontmatter.description).toBe('Analyze call');
    expect(result.frontmatter.tools).toEqual(['gmail']);
    expect(result.frontmatter.tags).toEqual(['sales']);
    expect(result.body).toBe('# Title\n\nStep 1.\n');
  });

  it('produces a default body when the draft body is blank', () => {
    const result = draftToSkillContent({ slug: 'my-skill', description: 'desc', body: '   ' });
    expect(result.body).toBe('# my-skill\n\n');
  });
});

describe('serializeSkill round-trip', () => {
  it('serializes and re-parses consistently', () => {
    const parsed = parseSkillFile(skillMarkdown, 'fallback');
    const serialized = serializeSkill(parsed.frontmatter, parsed.body);
    const round = parseSkillFile(serialized, 'fallback');

    expect(round.slug).toBe(parsed.slug);
    expect(round.description).toBe(parsed.description);
    expect(round.tools).toEqual(parsed.tools);
    expect(round.tags).toEqual(parsed.tags);
    expect(round.title).toBe(parsed.title);
  });
});
