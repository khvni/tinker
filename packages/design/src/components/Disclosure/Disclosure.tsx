import { useState, type ReactNode } from 'react';
import { cx } from '../cx.js';
import './Disclosure.css';

export type DisclosureTone = 'tool' | 'reasoning';

export type DisclosureProps = {
  summary: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  tone?: DisclosureTone;
  className?: string;
  children: ReactNode;
};

export const Disclosure = ({
  summary,
  defaultOpen = false,
  open,
  onOpenChange,
  tone = 'tool',
  className,
  children,
}: DisclosureProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const toggle = (): void => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <div
      className={cx(
        'tk-disclosure',
        `tk-disclosure--${tone}`,
        isOpen && 'tk-disclosure--open',
        className,
      )}
    >
      <button
        type="button"
        className="tk-disclosure__summary"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <span className="tk-disclosure__marker" aria-hidden="true" />
        <span className="tk-disclosure__label">{summary}</span>
      </button>
      {isOpen ? <div className="tk-disclosure__body">{children}</div> : null}
    </div>
  );
};
