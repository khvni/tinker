import type { HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import './Progress.css';

export type ProgressSpinnerSize = 'xs' | 'sm' | 'md';

type CommonProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'role'> & {
  label?: string;
};

type BarProps = CommonProps & {
  variant?: 'bar';
  value?: number;
  max?: number;
};

type SpinnerProps = CommonProps & {
  variant: 'spinner';
  size?: ProgressSpinnerSize;
};

export type ProgressProps = BarProps | SpinnerProps;

const clampValue = (value: number, max: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

export const Progress = (props: ProgressProps) => {
  if (props.variant === 'spinner') {
    const { size = 'sm', label = 'Loading', className, ...rest } = props;
    return (
      <span
        className={cx('tk-progress', 'tk-progress--spinner', `tk-progress--spinner-${size}`, className)}
        role="status"
        aria-label={label}
        {...rest}
      />
    );
  }

  const { value, max = 100, label, className, ...rest } = props;
  const isDeterminate = typeof value === 'number';
  const safeValue = isDeterminate ? clampValue(value, max) : 0;
  const percent = isDeterminate ? (safeValue / max) * 100 : 0;

  return (
    <span
      className={cx(
        'tk-progress',
        'tk-progress--bar',
        isDeterminate ? 'tk-progress--bar-determinate' : 'tk-progress--bar-indeterminate',
        className,
      )}
      role="progressbar"
      aria-label={label ?? 'Progress'}
      aria-valuemin={isDeterminate ? 0 : undefined}
      aria-valuemax={isDeterminate ? max : undefined}
      aria-valuenow={isDeterminate ? safeValue : undefined}
      {...rest}
    >
      <span
        className="tk-progress__fill"
        style={isDeterminate ? { width: `${percent}%` } : undefined}
      />
    </span>
  );
};
