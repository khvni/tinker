import type {
  SenseiInput,
  SenseiRecommendation,
  SkillStore,
} from '@ramp-glass/shared-types';

export const createSkillStore = (_config: { dojoPath: string }): SkillStore => {
  return {
    list: async () => {
      throw new Error('skills.list: not yet implemented — see tasks/skills.md');
    },
    get: async () => {
      throw new Error('skills.get: not yet implemented — see tasks/skills.md');
    },
    install: async () => {
      throw new Error('skills.install: not yet implemented — see tasks/skills.md');
    },
    uninstall: async () => {
      throw new Error('skills.uninstall: not yet implemented — see tasks/skills.md');
    },
    listInstalled: async () => {
      throw new Error('skills.listInstalled: not yet implemented — see tasks/skills.md');
    },
    watch: () => {
      throw new Error('skills.watch: not yet implemented — see tasks/skills.md');
    },
  };
};

export const senseiRecommend = async (
  _input: SenseiInput,
): Promise<SenseiRecommendation[]> => {
  throw new Error('senseiRecommend: not yet implemented — see tasks/dojo-web.md');
};
