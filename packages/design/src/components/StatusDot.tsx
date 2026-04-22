import type { HTMLAttributes } from 'react';
import { cx } from './cx.js';
import './StatusDot.css';

export type StatusDotState =
  | 'muted'
  | 'constructive'
  | 'warning'
  | 'danger'
  | 'info'
  | 'claude'
  | 'skill'
  | 'pulse'
  | 'halo';

export type StatusDotProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  state?: StatusDotState;
  label?: string;
};

export const StatusDot = ({ state = 'muted', label, className, ...rest }: StatusDotProps) => (
  <span
    className={cx('tk-statusdot', `tk-statusdot--${state}`, className)}
    role="status"
    aria-label={label ?? state}
    {...rest}
  />
);
