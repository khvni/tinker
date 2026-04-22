import type { ChatMessageRecord } from '../../historyReplay.js';
import { messageTextFromBlocks } from '../../Block.js';

const MAX_TURNS = 10;

const roleHeading = (role: ChatMessageRecord['role']): string => {
  switch (role) {
    case 'user':
      return '## User';
    case 'assistant':
      return '## Assistant';
    case 'system':
      return '## System';
  }
};

/**
 * Flatten the tail of a chat history into a markdown transcript suitable for
 * pre-filling the "Save as skill" body textarea.
 *
 * Behaviour:
 * - Keeps only `user` + `assistant` messages. System rows are dropped because
 *   they rarely carry content a future skill author wants to replay.
 * - Drops messages whose text blocks collapse to nothing (tool-only turns, or
 *   messages where every text block is whitespace).
 * - Uses at most the last `MAX_TURNS` kept messages so long sessions don't
 *   overflow the textarea.
 */
export const buildSkillTranscript = (messages: ReadonlyArray<ChatMessageRecord>): string => {
  const sections: string[] = [];

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }

    const text = messageTextFromBlocks(message.blocks).trim();
    if (text.length === 0) {
      continue;
    }

    sections.push(`${roleHeading(message.role)}\n${text}`);
  }

  const kept = sections.slice(-MAX_TURNS);
  return kept.length === 0 ? '' : `${kept.join('\n\n')}\n`;
};
