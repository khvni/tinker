import { describe, expect, it } from 'vitest';
import type { ChatMessageRecord } from '../../historyReplay.js';
import { buildSkillTranscript } from './buildSkillTranscript.js';

const textMessage = (
  id: string,
  role: ChatMessageRecord['role'],
  text: string,
): ChatMessageRecord => ({
  id,
  role,
  blocks: [{ kind: 'text', partID: `${id}-part`, text }],
});

describe('buildSkillTranscript', () => {
  it('returns empty string when no messages', () => {
    expect(buildSkillTranscript([])).toBe('');
  });

  it('formats user + assistant turns with markdown headings and trailing newline', () => {
    const output = buildSkillTranscript([
      textMessage('1', 'user', 'Hi'),
      textMessage('2', 'assistant', 'Hello.'),
    ]);
    expect(output).toBe('## User\nHi\n\n## Assistant\nHello.\n');
  });

  it('skips system messages', () => {
    const output = buildSkillTranscript([
      textMessage('sys', 'system', 'noise'),
      textMessage('u', 'user', 'Hi'),
      textMessage('a', 'assistant', 'Hello.'),
    ]);
    expect(output).toBe('## User\nHi\n\n## Assistant\nHello.\n');
  });

  it('drops turns with only whitespace text', () => {
    const output = buildSkillTranscript([
      textMessage('1', 'user', '   '),
      textMessage('2', 'assistant', 'Only answer here.'),
    ]);
    expect(output).toBe('## Assistant\nOnly answer here.\n');
  });

  it('keeps only the last 10 non-empty turns', () => {
    const messages: ChatMessageRecord[] = [];
    for (let index = 0; index < 20; index += 1) {
      messages.push(textMessage(`u-${index}`, 'user', `Q${index}`));
      messages.push(textMessage(`a-${index}`, 'assistant', `A${index}`));
    }

    const output = buildSkillTranscript(messages);
    const sectionCount = output.split('## ').length - 1;
    expect(sectionCount).toBe(10);
    expect(output.startsWith('## User\nQ15')).toBe(true);
    expect(output.endsWith('A19\n')).toBe(true);
  });

  it('ignores tool/reasoning-only messages that contain no text', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'tool-only',
        role: 'assistant',
        blocks: [
          {
            kind: 'tool',
            partID: 'tool-1',
            name: 'read',
            input: {},
            state: 'completed',
            output: 'ignored',
          },
        ],
      },
      textMessage('u', 'user', 'Hi'),
    ];

    expect(buildSkillTranscript(messages)).toBe('## User\nHi\n');
  });
});
