import type { RunEvent, StoredRunEvent } from '@tinker/shared-types';
import type { Block } from './Block.js';

export type ChatMessageRecord = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blocks: Block[];
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

const applyEventToBlocks = (blocks: Block[], event: RunEvent): Block[] => {
  if (event.type === 'token') {
    const existing = blocks.find((b) => b.partID === event.partID);
    if (existing && existing.kind === 'text') {
      return upsertBlock(blocks, { ...existing, text: existing.text + event.text });
    }
    return upsertBlock(blocks, { kind: 'text', partID: event.partID, text: event.text });
  }

  if (event.type === 'reasoning') {
    const existing = blocks.find((b) => b.partID === event.partID);
    if (existing && existing.kind === 'reasoning') {
      return upsertBlock(blocks, { ...existing, text: existing.text + event.text });
    }
    return upsertBlock(blocks, { kind: 'reasoning', partID: event.partID, text: event.text });
  }

  if (event.type === 'tool_call') {
    return upsertBlock(blocks, {
      kind: 'tool',
      partID: event.partID,
      name: event.name,
      input: event.input,
      state: 'pending',
    });
  }

  if (event.type === 'tool_result') {
    const existing = blocks.find((b) => b.partID === event.partID);
    return upsertBlock(blocks, {
      kind: 'tool',
      partID: event.partID,
      name: event.name,
      input: existing?.kind === 'tool' ? existing.input : {},
      state: 'completed',
      output: event.output,
    });
  }

  if (event.type === 'tool_error') {
    const existing = blocks.find((b) => b.partID === event.partID);
    return upsertBlock(blocks, {
      kind: 'tool',
      partID: event.partID,
      name: event.name,
      input: existing?.kind === 'tool' ? existing.input : {},
      state: 'error',
      error: event.message,
    });
  }

  if (event.type === 'approval_request') {
    return upsertBlock(blocks, {
      kind: 'approval',
      partID: event.partID,
      tool: event.tool,
      input: event.input,
      description: event.description,
    });
  }

  if (event.type === 'delegate') {
    return upsertBlock(blocks, {
      kind: 'delegate',
      partID: event.partID,
      agent: event.agent,
      protocol: event.protocol,
      description: event.description,
    });
  }

  if (event.type === 'subagent') {
    return upsertBlock(blocks, {
      kind: 'subagent',
      partID: event.partID,
      agent: event.agent,
      description: event.description,
    });
  }

  return blocks;
};

export const replayRunEvents = (entries: readonly StoredRunEvent[]): ChatMessageRecord[] => {
  const messages: ChatMessageRecord[] = [];
  let assistantBlocks: Block[] = [];
  let assistantId = 'assistant-replay';

  for (const entry of entries) {
    const event = entry.event;

    if (
      event.type === 'token'
      || event.type === 'reasoning'
      || event.type === 'tool_call'
      || event.type === 'tool_result'
      || event.type === 'tool_error'
      || event.type === 'approval_request'
      || event.type === 'delegate'
      || event.type === 'subagent'
    ) {
      assistantBlocks = applyEventToBlocks(assistantBlocks, event);
    } else if (event.type === 'done') {
      if (assistantBlocks.length > 0) {
        messages.push({ id: assistantId, role: 'assistant', blocks: assistantBlocks });
        assistantBlocks = [];
        assistantId = `assistant-replay-${messages.length}`;
      }
    }
  }

  if (assistantBlocks.length > 0) {
    messages.push({ id: assistantId, role: 'assistant', blocks: assistantBlocks });
  }

  return messages;
};
