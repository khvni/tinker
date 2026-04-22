import type { HTMLAttributes } from 'react';
import { cx } from './cx.js';
import './ContextBadge.css';

export type ContextBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'title' | 'children'> & {
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

const toneFor = (percent: number): 'ok' | 'warn' | 'hot' => {
  if (percent > 80) return 'hot';
  if (percent >= 50) return 'warn';
  return 'ok';
};

const formatCount = (value: number): string =>
  Number.isFinite(value) ? Math.round(value).toLocaleString() : '0';

export const ContextBadge = ({
  percent,
  tokens,
  windowSize,
  model,
  className,
  ...rest
}: ContextBadgeProps) => {
  const clamped = clampPercent(percent);
  const tone = toneFor(clamped);
  const label = `${Math.round(clamped)}%`;
  const tooltip = `${formatCount(tokens)} / ${formatCount(windowSize)} · ${model}`;

  return (
    <span
      className={cx('tk-context-badge', `tk-context-badge--${tone}`, className)}
      role="status"
      aria-label={`Context ${label}. ${tooltip}`}
      title={tooltip}
      {...rest}
    >
      {label}
    </span>
  );
};
