import type { HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import './ContextPill.css';

export type ContextPillProps = Omit<HTMLAttributes<HTMLSpanElement>, 'title' | 'children'> & {
  percent: number;
  tokens: number;
  windowSize: number;
  model: string;
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const formatCount = (value: number): string =>
  Number.isFinite(value) ? Math.round(value).toLocaleString() : '0';

const FileDocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ContextPill = ({
  percent,
  tokens,
  windowSize,
  model,
  className,
  ...rest
}: ContextPillProps) => {
  const clamped = clampPercent(percent);
  const label = `${Math.round(clamped)}%`;
  const tooltip = `${formatCount(tokens)} / ${formatCount(windowSize)} · ${model}`;

  return (
    <span
      className={cx('tk-context-pill', className)}
      role="status"
      aria-label={`Context ${label}. ${tooltip}`}
      title={tooltip}
      {...rest}
    >
      <span className="tk-context-pill__icon" aria-hidden="true">
        <FileDocIcon />
      </span>
      <span className="tk-context-pill__label">Context</span>
      <span className="tk-context-pill__separator" aria-hidden="true" />
      <span className="tk-context-pill__percent">{label}</span>
    </span>
  );
};
