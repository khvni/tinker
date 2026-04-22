import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SKILL_VERSION, type Skill } from '@tinker/shared-types';
import { buildSkillContext, injectActiveSkills } from './skill-injector.js';

const makeSkill = (overrides: Partial<Skill>): Skill => ({
  id: 'example',
  slug: 'example',
  title: 'Example',
  role: null,
  description: 'Describes example',
  tools: [],
  tags: [],
  version: DEFAULT_SKILL_VERSION,
  author: null,
  body: '# Example\n\nDo the thing.',
  relativePath: '.tinker/skills/example.md',
  frontmatter: { id: 'example', title: 'Example', version: DEFAULT_SKILL_VERSION, description: 'Describes example' },
  lastModified: '2026-04-15T00:00:00.000Z',
  active: false,
  installedAt: '2026-04-15T00:00:00.000Z',
  ...overrides,
});

describe('buildSkillContext', () => {
  it('returns null when no skills are active', () => {
    expect(buildSkillContext([])).toBeNull();
    expect(buildSkillContext([makeSkill({ active: false })])).toBeNull();
  });

  it('includes only active skills and embeds their body', () => {
    const skills = [
      makeSkill({ slug: 'a', title: 'Alpha', active: true, body: 'Alpha body' }),
      makeSkill({ slug: 'b', title: 'Beta', active: false, body: 'Beta body' }),
    ];

    const text = buildSkillContext(skills);
    expect(text).not.toBeNull();
    expect(text).toContain('Alpha body');
    expect(text).not.toContain('Beta body');
    expect(text).toContain('Skill: Alpha (a)');
  });

  it('lists tools and tags in the rendered block when present', () => {
    const text = buildSkillContext([
      makeSkill({ slug: 'x', title: 'X', active: true, tools: ['gmail'], tags: ['sales'] }),
    ]);

    expect(text).toContain('Tools: gmail');
    expect(text).toContain('Tags: sales');
  });
});

describe('injectActiveSkills', () => {
  it('skips the OpenCode call when no skill is active', async () => {
    const session = { prompt: vi.fn().mockResolvedValue(undefined) };
    await injectActiveSkills({ session } as never, 'session-1', [makeSkill({ active: false })]);

    expect(session.prompt).not.toHaveBeenCalled();
  });

  it('sends a noReply prompt with the rendered context when any skill is active', async () => {
    const session = { prompt: vi.fn().mockResolvedValue(undefined) };
    const skills = [makeSkill({ slug: 'a', active: true, body: 'Body' })];

    await injectActiveSkills({ session } as never, 'session-1', skills);

    expect(session.prompt).toHaveBeenCalledTimes(1);
    const call = session.prompt.mock.calls[0]?.[0] as {
      sessionID: string;
      noReply: boolean;
      parts: Array<{ type: string; text: string }>;
    };
    expect(call.sessionID).toBe('session-1');
    expect(call.noReply).toBe(true);
    expect(call.parts[0]?.text).toContain('Body');
  });
});
