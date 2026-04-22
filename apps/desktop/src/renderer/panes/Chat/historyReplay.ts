import type { Part } from '@opencode-ai/sdk/v2/client';
import type { StoredChatEvent } from '@tinker/bridge';
import { partToBlock, type Block } from './Block.js';

export type ChatMessageRecord = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blocks: Block[];
};

type ReplayMessageState = ChatMessageRecord & {
  createdAt: number | null;
  order: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const readString = (value: Record<string, unknown>, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
};

const readMessageRole = (value: unknown): ChatMessageRecord['role'] | null => {
  return value === 'user' || value === 'assistant' || value === 'system' ? value : null;
};

const readCreatedAt = (value: unknown): number | null => {
  if (!isRecord(value)) {
    return null;
  }

  const created = value.created;
  return typeof created === 'number' && Number.isFinite(created) ? created : null;
};

const asMessagePart = (value: unknown): (Part & { messageID: string }) | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const type = readString(value, 'type');
  const messageID = readString(value, 'messageID');
  if (!id || !type || !messageID) {
    return null;
  }

  return value as Part & { messageID: string };
};

const upsertBlock = (blocks: Block[], next: Block): Block[] => {
  const index = blocks.findIndex((block) => block.partID === next.partID);
  if (index === -1) {
    return [...blocks, next];
  }

  const copy = [...blocks];
  copy[index] = next;
  return copy;
};

const ensureMessage = (
  messages: Map<string, ReplayMessageState>,
  nextOrder: () => number,
  id: string,
  role?: ChatMessageRecord['role'],
  createdAt?: number | null,
): ReplayMessageState => {
  const existing = messages.get(id);
  if (existing) {
    const nextRole = role ?? existing.role;
    const nextCreatedAt = createdAt ?? existing.createdAt;
    if (nextRole !== existing.role || nextCreatedAt !== existing.createdAt) {
      const updated = { ...existing, role: nextRole, createdAt: nextCreatedAt };
      messages.set(id, updated);
      return updated;
    }

    return existing;
  }

  const created = {
    id,
    role: role ?? 'assistant',
    blocks: [],
    createdAt: createdAt ?? null,
    order: nextOrder(),
  } satisfies ReplayMessageState;
  messages.set(id, created);
  return created;
};

const finalizeMessages = (messages: Map<string, ReplayMessageState>): ChatMessageRecord[] => {
  return [...messages.values()]
    .sort((left, right) => {
      if (left.createdAt !== null && right.createdAt !== null && left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }

      return left.order - right.order;
    })
    .map(({ createdAt: _createdAt, order: _order, ...message }) => {
      const hasText = message.blocks.some((block) => block.kind === 'text' && block.text.length > 0);
      if (hasText || (message.role === 'assistant' && message.blocks.length > 0)) {
        return message;
      }

      const placeholder =
        message.role === 'assistant' ? 'Response contained only non-text output.' : 'Message sent.';

      return {
        ...message,
        blocks: [
          ...message.blocks,
          {
            kind: 'text',
            partID: `placeholder-${message.id}`,
            text: placeholder,
          },
        ],
      };
    });
};

export const replayChatHistory = (entries: readonly StoredChatEvent[]): ChatMessageRecord[] => {
  const messages = new Map<string, ReplayMessageState>();
  let order = 0;
  const nextOrder = (): number => {
    order += 1;
    return order;
  };

  for (const entry of entries) {
    if (!isRecord(entry.data)) {
      continue;
    }

    if (entry.event === 'message.updated') {
      const info = isRecord(entry.data.info) ? entry.data.info : null;
      const id = info ? readString(info, 'id') : null;
      const role = info ? readMessageRole(info.role) : null;
      if (!id || !role) {
        continue;
      }

      ensureMessage(messages, nextOrder, id, role, info ? readCreatedAt(info.time) : null);
      continue;
    }

    if (entry.event === 'message.removed') {
      const id =
        readString(entry.data, 'messageID')
        ?? (isRecord(entry.data.info) ? readString(entry.data.info, 'id') : null);
      if (id) {
        messages.delete(id);
      }
      continue;
    }

    if (entry.event === 'message.part.updated') {
      const part = asMessagePart(entry.data.part);
      if (!part) {
        continue;
      }

      const message = ensureMessage(messages, nextOrder, part.messageID);
      const block = partToBlock(part);
      if (!block) {
        continue;
      }

      const updated = { ...message, blocks: upsertBlock(message.blocks, block) };
      messages.set(message.id, updated);
      continue;
    }

    if (entry.event === 'message.part.delta') {
      const messageID = readString(entry.data, 'messageID');
      const partID = readString(entry.data, 'partID');
      const field = readString(entry.data, 'field');
      const delta = readString(entry.data, 'delta');
      if (!messageID || !partID || field !== 'text' || delta === null) {
        continue;
      }

      const message = ensureMessage(messages, nextOrder, messageID);
      const existing = message.blocks.find((block) => block.partID === partID) ?? null;
      let nextBlock: Block;

      if (existing?.kind === 'reasoning') {
        nextBlock = { ...existing, text: existing.text + delta };
      } else if (existing?.kind === 'text') {
        nextBlock = { ...existing, text: existing.text + delta };
      } else {
        nextBlock = { kind: 'text', partID, text: delta };
      }

      messages.set(message.id, { ...message, blocks: upsertBlock(message.blocks, nextBlock) });
      continue;
    }

    if (entry.event === 'message.part.removed') {
      const messageID = readString(entry.data, 'messageID');
      const partID = readString(entry.data, 'partID');
      if (!messageID || !partID) {
        continue;
      }

      const message = messages.get(messageID);
      if (!message) {
        continue;
      }

      messages.set(message.id, {
        ...message,
        blocks: message.blocks.filter((block) => block.partID !== partID),
      });
    }
  }

  return finalizeMessages(messages);
};
