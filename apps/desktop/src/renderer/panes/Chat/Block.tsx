import type { JSX } from 'react';
import type { Part } from '@opencode-ai/sdk/v2/client';
import { Disclosure } from '@tinker/design';

export type Block =
  | { kind: 'text'; partID: string; text: string }
  | { kind: 'reasoning'; partID: string; text: string }
  | {
      kind: 'tool';
      partID: string;
      name: string;
      input: Record<string, unknown>;
      state: 'pending' | 'completed' | 'error';
      output?: string;
      error?: string;
    };

export const partToBlock = (part: Part): Block | null => {
  if (part.type === 'text') {
    return { kind: 'text', partID: part.id, text: part.text };
  }
  if (part.type === 'reasoning') {
    return { kind: 'reasoning', partID: part.id, text: part.text };
  }
  if (part.type !== 'tool') {
    return null;
  }
  switch (part.state.status) {
    case 'pending':
    case 'running':
      return {
        kind: 'tool',
        partID: part.id,
        name: part.tool,
        input: part.state.input,
        state: 'pending',
      };
    case 'completed':
      return {
        kind: 'tool',
        partID: part.id,
        name: part.tool,
        input: part.state.input,
        state: 'completed',
        output: part.state.output,
      };
    case 'error':
      return {
        kind: 'tool',
        partID: part.id,
        name: part.tool,
        input: part.state.input,
        state: 'error',
        error: part.state.error,
      };
  }
};

export const messageTextFromBlocks = (blocks: readonly Block[]): string => {
  let out = '';
  for (const block of blocks) {
    if (block.kind === 'text') {
      out += block.text;
    }
  }
  return out;
};

const formatToolInput = (input: Record<string, unknown>): string => {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
};

type MessageBlockProps = {
  block: Block;
  isOpen: boolean;
  onToggle: (next: boolean) => void;
};

export const MessageBlock = ({ block, isOpen, onToggle }: MessageBlockProps): JSX.Element | null => {
  if (block.kind === 'text') {
    return <p className="tinker-message-text">{block.text}</p>;
  }

  if (block.kind === 'reasoning') {
    return (
      <Disclosure summary="Thinking…" tone="reasoning" open={isOpen} onOpenChange={onToggle}>
        <p className="tinker-message-text">{block.text}</p>
      </Disclosure>
    );
  }

  const summary = block.state === 'pending' ? `running ${block.name}…` : `used ${block.name}`;
  return (
    <Disclosure summary={summary} tone="tool" open={isOpen} onOpenChange={onToggle}>
      <pre className="tinker-tool-pre">{formatToolInput(block.input)}</pre>
      {block.state === 'completed' && block.output ? (
        <pre className="tinker-tool-pre">{block.output}</pre>
      ) : null}
      {block.state === 'error' && block.error ? (
        <pre className="tinker-tool-pre" data-variant="error">
          {block.error}
        </pre>
      ) : null}
    </Disclosure>
  );
};
