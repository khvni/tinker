import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILL_VERSION } from '@tinker/shared-types';
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

const canonicalSkillMarkdown = `---
author: byalikhani
id: gong-call-analysis
role: sales
tools:
  - gmail
title: Gong Call Analysis
version: 2.1.0
---

## When to Use This
After a sales call lands in Gong.

## How to Do It
1. Pull transcript.
2. Summarize objections.
`;

const legacySkillMarkdown = `---
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
  it('extracts canonical skill metadata from the new frontmatter shape', () => {
    const parsed = parseSkillFile(canonicalSkillMarkdown, 'fallback-slug');

    expect(parsed.id).toBe('gong-call-analysis');
    expect(parsed.slug).toBe('gong-call-analysis');
    expect(parsed.title).toBe('Gong Call Analysis');
    expect(parsed.role).toBe('sales');
    expect(parsed.tools).toEqual(['gmail']);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.author).toBe('byalikhani');
    expect(parsed.frontmatter).toEqual({
      id: 'gong-call-analysis',
      title: 'Gong Call Analysis',
      role: 'sales',
      tools: ['gmail'],
      version: '2.1.0',
      author: 'byalikhani',
    });
  });

  it('normalizes legacy skill frontmatter into the canonical spec', () => {
    const parsed = parseSkillFile(legacySkillMarkdown, 'fallback-slug');

    expect(parsed.id).toBe('gong-call-analysis');
    expect(parsed.slug).toBe('gong-call-analysis');
    expect(parsed.title).toBe('Gong Call Analysis');
    expect(parsed.role).toBeNull();
    expect(parsed.description).toBe('Analyze a Gong call transcript and surface coaching moments.');
    expect(parsed.tools).toEqual(['gmail']);
    expect(parsed.tags).toEqual(['sales', 'calls']);
    expect(parsed.version).toBe(DEFAULT_SKILL_VERSION);
    expect(parsed.author).toBeNull();
    expect(parsed.frontmatter.id).toBe('gong-call-analysis');
    expect(parsed.frontmatter.title).toBe('Gong Call Analysis');
    expect(parsed.frontmatter.version).toBe(DEFAULT_SKILL_VERSION);
    expect(parsed.frontmatter.name).toBeUndefined();
    expect(parsed.body).toContain('# Gong Call Analysis');
  });

  it('falls back to the supplied slug when frontmatter is missing', () => {
    const parsed = parseSkillFile('Body only, no frontmatter.', 'fallback-slug');

    expect(parsed.id).toBe('fallback-slug');
    expect(parsed.slug).toBe('fallback-slug');
    expect(parsed.title).toBe('fallback-slug');
    expect(parsed.role).toBeNull();
    expect(parsed.description).toBe('');
    expect(parsed.tools).toEqual([]);
    expect(parsed.tags).toEqual([]);
    expect(parsed.version).toBe(DEFAULT_SKILL_VERSION);
    expect(parsed.author).toBeNull();
  });

  it('slugifies invalid frontmatter ids', () => {
    const parsed = parseSkillFile(
      '---\nid: Bad Name!\ndescription: desc\n---\n\n# Title\n',
      'fallback',
    );

    expect(parsed.id).toBe('bad-name');
    expect(parsed.slug).toBe('bad-name');
    expect(parsed.frontmatter.id).toBe('bad-name');
  });
});

describe('draftToSkillContent', () => {
  it('builds frontmatter + body from a draft', () => {
    const result = draftToSkillContent({
      slug: 'Gong Call Analysis',
      title: 'Gong Call Analysis',
      role: 'sales',
      description: ' Analyze call ',
      body: '# Title\n\nStep 1.\n',
      tools: ['gmail'],
      tags: ['sales'],
      version: '2.0.0',
      author: 'byalikhani',
    });

    expect(result.slug).toBe('gong-call-analysis');
    expect(result.frontmatter.id).toBe('gong-call-analysis');
    expect(result.frontmatter.title).toBe('Gong Call Analysis');
    expect(result.frontmatter.role).toBe('sales');
    expect(result.frontmatter.description).toBe('Analyze call');
    expect(result.frontmatter.tools).toEqual(['gmail']);
    expect(result.frontmatter.tags).toEqual(['sales']);
    expect(result.frontmatter.version).toBe('2.0.0');
    expect(result.frontmatter.author).toBe('byalikhani');
    expect(result.body).toBe('# Title\n\nStep 1.\n');
  });

  it('produces canonical defaults when draft metadata is sparse', () => {
    const result = draftToSkillContent({ slug: 'my-skill', description: 'desc', body: '   ' });

    expect(result.frontmatter.id).toBe('my-skill');
    expect(result.frontmatter.title).toBe('my-skill');
    expect(result.frontmatter.version).toBe(DEFAULT_SKILL_VERSION);
    expect(result.body).toBe('# my-skill\n\n');
  });
});

describe('serializeSkill round-trip', () => {
  it('serializes canonical frontmatter and re-parses consistently', () => {
    const parsed = parseSkillFile(legacySkillMarkdown, 'fallback');
    const serialized = serializeSkill(parsed.frontmatter, parsed.body);
    const round = parseSkillFile(serialized, 'fallback');

    expect(serialized).toContain('id: gong-call-analysis');
    expect(serialized).toContain(`version: ${DEFAULT_SKILL_VERSION}`);
    expect(serialized).not.toContain('name:');
    expect(round.id).toBe(parsed.id);
    expect(round.slug).toBe(parsed.slug);
    expect(round.description).toBe(parsed.description);
    expect(round.tools).toEqual(parsed.tools);
    expect(round.tags).toEqual(parsed.tags);
    expect(round.title).toBe(parsed.title);
    expect(round.version).toBe(parsed.version);
  });
});
