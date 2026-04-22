import { describe, expect, it, vi } from 'vitest';
import type { SkillGitConfig, SkillStore } from '@tinker/shared-types';
import { runSkillAutoSync } from './skill-auto-sync.js';

const GIT_CONFIG: SkillGitConfig = {
  remoteUrl: 'git@github.com:example/skills.git',
  branch: 'main',
};

const makeStore = (config: SkillGitConfig | null): Pick<SkillStore, 'getGitConfig'> => ({
  getGitConfig: () => Promise.resolve(config),
});

describe('runSkillAutoSync', () => {
  it('no-ops when git is not available', async () => {
    const syncSkills = vi.fn();
    const isGitAvailable = vi.fn(async () => false);

    await runSkillAutoSync({
      skillStore: makeStore(GIT_CONFIG),
      skillsRootPath: '/home/user/.tinker',
      isGitAvailable,
      syncSkills,
    });

    expect(isGitAvailable).toHaveBeenCalledTimes(1);
    expect(syncSkills).not.toHaveBeenCalled();
  });

  it('no-ops when no git config is saved', async () => {
    const syncSkills = vi.fn();
    await runSkillAutoSync({
      skillStore: makeStore(null),
      skillsRootPath: '/home/user/.tinker',
      isGitAvailable: async () => true,
      syncSkills,
    });

    expect(syncSkills).not.toHaveBeenCalled();
  });

  it('no-ops when the skill root path has not been resolved', async () => {
    const syncSkills = vi.fn();
    await runSkillAutoSync({
      skillStore: makeStore(GIT_CONFIG),
      skillsRootPath: null,
      isGitAvailable: async () => true,
      syncSkills,
    });

    expect(syncSkills).not.toHaveBeenCalled();
  });

  it('invokes syncSkills with root path + git config on the happy path', async () => {
    const syncSkills = vi.fn(async () => ({ pulled: [], pushed: [], conflicts: [], message: 'up to date' }));
    await runSkillAutoSync({
      skillStore: makeStore(GIT_CONFIG),
      skillsRootPath: '/home/user/.tinker',
      isGitAvailable: async () => true,
      syncSkills,
    });

    expect(syncSkills).toHaveBeenCalledTimes(1);
    expect(syncSkills).toHaveBeenCalledWith('/home/user/.tinker', GIT_CONFIG);
  });

  it('propagates errors from the underlying sync call', async () => {
    const syncSkills = vi.fn(async () => {
      throw new Error('merge aborted');
    });

    await expect(
      runSkillAutoSync({
        skillStore: makeStore(GIT_CONFIG),
        skillsRootPath: '/home/user/.tinker',
        isGitAvailable: async () => true,
        syncSkills,
      }),
    ).rejects.toThrow('merge aborted');
  });
});
