import type { OpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { Skill } from '@tinker/shared-types';

const skillSection = (skill: Skill): string => {
  const tools = skill.tools.length > 0 ? `\n_Tools: ${skill.tools.join(', ')}_` : '';
  const tags = skill.tags.length > 0 ? `\n_Tags: ${skill.tags.join(', ')}_` : '';
  return `### Skill: ${skill.title} (${skill.slug})\n${skill.description}${tools}${tags}\n\n${skill.body.trim()}`;
};

export const buildSkillContext = (skills: Skill[]): string | null => {
  const active = skills.filter((skill) => skill.active);
  if (active.length === 0) {
    return null;
  }

  const header =
    'The following Playbook skills are active for this session. Follow the instructions when their "When to Use This" triggers fire.';

  return [header, '', ...active.map(skillSection)].join('\n\n');
};

export const injectActiveSkills = async (
  client: Pick<OpencodeClient, 'session'>,
  sessionID: string,
  skills: Skill[],
): Promise<void> => {
  const text = buildSkillContext(skills);

  if (!text) {
    return;
  }

  await client.session.prompt({
    sessionID,
    noReply: true,
    parts: [{ type: 'text', text }],
  });
};
