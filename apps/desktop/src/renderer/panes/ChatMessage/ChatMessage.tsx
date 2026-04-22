import { isValidElement, useEffect, useRef, useState, type JSX, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@tinker/design';
import { CodeBlock } from './CodeBlock.js';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

type ChatMessageProps = {
  role: ChatMessageRole;
  text: string;
  streaming?: boolean;
  onSaveAsSkill?: () => void;
};

const COPIED_FLASH_MS = 1000;
const LANGUAGE_PATTERN = /language-([\w+-]+)/;

const writeToClipboard = async (value: string): Promise<boolean> => {
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    await clipboard.writeText(value);
    return true;
  }

  return false;
};

const stripTrailingNewline = (value: string): string =>
  value.endsWith('\n') ? value.slice(0, -1) : value;

const extractCodeText = (children: ReactNode): string => {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(extractCodeText).join('');
  }

  if (children == null || typeof children === 'boolean') {
    return '';
  }

  if (typeof children === 'number') {
    return String(children);
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    return extractCodeText(children.props.children);
  }

  return '';
};

const isCodeElement = (
  value: ReactNode,
): value is ReactElement<{ className?: string; children?: ReactNode }> =>
  isValidElement<{ className?: string; children?: ReactNode }>(value) && value.type === 'code';

const extractLanguage = (className: string | undefined): string => {
  const match = (className ?? '').match(LANGUAGE_PATTERN);
  return match?.[1] ?? 'text';
};

const MARKDOWN_COMPONENTS: Components = {
  pre: ({ children }) => {
    const codeChild = Array.isArray(children)
      ? children.find((child) => isCodeElement(child))
      : children;

    if (isCodeElement(codeChild)) {
      const language = extractLanguage(codeChild.props.className);
      const code = stripTrailingNewline(extractCodeText(codeChild.props.children));
      return <CodeBlock language={language} code={code} />;
    }

    return <pre>{children}</pre>;
  },
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
      {children}
    </a>
  ),
};

export const ChatMessage = ({
  role,
  text,
  streaming = false,
  onSaveAsSkill,
}: ChatMessageProps): JSX.Element => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async (): Promise<void> => {
    try {
      const success = await writeToClipboard(text);
      if (!success) {
        return;
      }

      setCopied(true);

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, COPIED_FLASH_MS);
    } catch {
      /* clipboard unavailable — silently no-op */
    }
  };

  if (role !== 'assistant') {
    return (
      <div className={`tinker-message tinker-message--${role}`}>
        <p className="tinker-message-text">{text}</p>
      </div>
    );
  }

  const hasContent = text.trim().length > 0;
  const showActions = hasContent && !streaming;
  const className = `tinker-message tinker-message--assistant${streaming ? ' tinker-message--streaming' : ''}`;

  return (
    <div className={className}>
      <div className="tinker-chat-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {text}
        </ReactMarkdown>
      </div>
      {showActions ? (
        <div className="tinker-message-actions tinker-chat-message-actions">
          <Button
            variant="ghost"
            size="s"
            className="tinker-chat-copy-msg"
            onClick={() => {
              void handleCopy();
            }}
            aria-label={copied ? 'Copied message' : 'Copy message'}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {onSaveAsSkill ? (
            <Button variant="ghost" size="s" onClick={onSaveAsSkill}>
              Save as skill
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
