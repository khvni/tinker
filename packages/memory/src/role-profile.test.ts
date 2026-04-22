import { describe, expect, it } from 'vitest';
import { inferRoleProfile } from './role-profile.js';

type RoleProfileSkillInput = Parameters<typeof inferRoleProfile>[0]['skills'][number];

const makeSkill = (overrides: Partial<RoleProfileSkillInput>): RoleProfileSkillInput => {
  return {
    active: false,
    installedAt: '2026-04-01T00:00:00.000Z',
    slug: 'skill',
    tags: [],
    tools: [],
    ...overrides,
  };
};

describe('inferRoleProfile', () => {
  it('normalizes connected tool ids and orders frequented skills by active state then recency', () => {
    const profile = inferRoleProfile({
      connectedTools: [' github ', 'LINEAR', 'github', ''],
      skills: [
        makeSkill({ slug: 'older-active', active: true, installedAt: '2026-04-01T00:00:00.000Z' }),
        makeSkill({ slug: 'newer-active', active: true, installedAt: '2026-04-02T00:00:00.000Z' }),
        makeSkill({ slug: 'recent-passive', installedAt: '2026-04-03T00:00:00.000Z' }),
      ],
    });

    expect(profile.connectedTools).toEqual(['github', 'linear']);
    expect(profile.frequentedSkills).toEqual(['newer-active', 'older-active', 'recent-passive']);
  });

  it('infers engineering from connected tool signals when no role-tagged skills exist yet', () => {
    const profile = inferRoleProfile({
      connectedTools: ['github', 'linear'],
      skills: [makeSkill({ slug: 'ship-pr', tools: ['github'] })],
    });

    expect(profile.roleLabel).toBe('engineering');
  });

  it('maps support-oriented skill tags into the cx role label', () => {
    const profile = inferRoleProfile({
      connectedTools: [],
      skills: [makeSkill({ slug: 'triage-ticket', active: true, tags: ['support'] })],
    });

    expect(profile.roleLabel).toBe('cx');
  });

  it('falls back to generalist when neither connected tools nor skill history carry role signals', () => {
    const profile = inferRoleProfile({
      connectedTools: ['exa', 'qmd'],
      skills: [makeSkill({ slug: 'workspace-cleanup', tags: ['cleanup'], tools: ['exa'] })],
    });

    expect(profile.roleLabel).toBe('generalist');
  });
});
