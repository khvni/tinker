import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@tinker/design';
import { MAX_HIGHLIGHTABLE_CODE_LENGTH, highlightCode } from '../../renderers/code-highlighter.js';

type CodeBlockProps = {
  language: string;
  code: string;
};

const COPIED_FLASH_MS = 1000;

const writeToClipboard = async (value: string): Promise<boolean> => {
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    await clipboard.writeText(value);
    return true;
  }

  return false;
};

export const CodeBlock = ({ language, code }: CodeBlockProps): JSX.Element => {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (code.length > MAX_HIGHLIGHTABLE_CODE_LENGTH) {
      setHighlighted(null);
      return;
    }

    let active = true;

    void highlightCode(code, language).then((html) => {
      if (active) {
        setHighlighted(html);
      }
    });

    return () => {
      active = false;
    };
  }, [code, language]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const sanitizedHighlighted = useMemo(
    () => (highlighted ? DOMPurify.sanitize(highlighted) : null),
    [highlighted],
  );

  const handleCopy = async (): Promise<void> => {
    try {
      const success = await writeToClipboard(code);
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

  return (
    <div className="tinker-chat-codeblock">
      <div className="tinker-chat-codeblock__header">
        <span className="tinker-chat-codeblock__lang">{language}</span>
        <Button
          variant="ghost"
          size="s"
          className="tinker-chat-codeblock__copy"
          onClick={() => {
            void handleCopy();
          }}
          aria-label={copied ? 'Copied code' : 'Copy code'}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="tinker-chat-codeblock__pre">
        {sanitizedHighlighted ? (
          <code
            className={`tinker-code-content hljs language-${language}`}
            dangerouslySetInnerHTML={{ __html: sanitizedHighlighted }}
          />
        ) : (
          <code className={`tinker-code-content language-${language}`}>{code}</code>
        )}
      </pre>
    </div>
  );
};
