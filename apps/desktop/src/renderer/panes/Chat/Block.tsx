import { type JSX, useCallback } from 'react';
import { Button, Disclosure } from '@tinker/design';

export type Block =
  | { kind: 'text'; partID: string; text: string }
  | { kind: 'reasoning'; partID: string; text: string }
  | {
      kind: 'tool';
      partID: string;
      name: string;
      input: Record<string, unknown>;
      state: 'pending' | 'completed' | 'error';
      output?: string | undefined;
      error?: string | undefined;
    }
  | {
      kind: 'approval';
      partID: string;
      tool: string;
      input: Record<string, unknown>;
      description: string;
    }
  | {
      kind: 'delegate';
      partID: string;
      agent: string;
      protocol: string;
      description: string;
    }
  | {
      kind: 'subagent';
      partID: string;
      agent: string;
      description: string;
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
  onApprove?: (partID: string, approved: boolean) => void;
};

export const MessageBlock = ({ block, isOpen, onToggle, onApprove }: MessageBlockProps): JSX.Element | null => {
  const handleApprove = useCallback(() => onApprove?.(block.partID, true), [block.partID, onApprove]);
  const handleDeny = useCallback(() => onApprove?.(block.partID, false), [block.partID, onApprove]);

  if (block.kind === 'text') {
    return <p className="tinker-message-text">{block.text}</p>;
  }

  if (block.kind === 'reasoning') {
    return (
      <Disclosure summary="Thinking\u2026" tone="reasoning" open={isOpen} onOpenChange={onToggle}>
        <p className="tinker-message-text">{block.text}</p>
      </Disclosure>
    );
  }

  if (block.kind === 'approval') {
    return (
      <Disclosure summary={`Approval: ${block.tool}`} tone="tool" open={isOpen} onOpenChange={onToggle}>
        <p className="tinker-message-text">{block.description}</p>
        <pre className="tinker-tool-pre">{formatToolInput(block.input)}</pre>
        {onApprove ? (
          <div className="tinker-approval-actions">
            <Button variant="primary" size="s" onClick={handleApprove}>Approve</Button>
            <Button variant="ghost" size="s" onClick={handleDeny}>Deny</Button>
          </div>
        ) : null}
      </Disclosure>
    );
  }

  if (block.kind === 'delegate') {
    return (
      <Disclosure summary={`Delegate: ${block.agent} (${block.protocol})`} tone="tool" open={isOpen} onOpenChange={onToggle}>
        <p className="tinker-message-text">{block.description}</p>
      </Disclosure>
    );
  }

  if (block.kind === 'subagent') {
    return (
      <Disclosure summary={`Subagent: ${block.agent}`} tone="tool" open={isOpen} onOpenChange={onToggle}>
        <p className="tinker-message-text">{block.description}</p>
      </Disclosure>
    );
  }

  const summary = block.state === 'pending' ? `running ${block.name}\u2026` : `used ${block.name}`;
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
