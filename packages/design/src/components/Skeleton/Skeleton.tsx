import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import './Skeleton.css';

export type SkeletonVariant = 'text' | 'circle' | 'rect';

export type SkeletonProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
};

const toDim = (value: number | string | undefined): string | undefined => {
  if (value == null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

export const Skeleton = ({
  variant = 'text',
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) => {
  const w = toDim(width);
  const h = toDim(height);

  const resolved: CSSProperties = { ...style };
  if (w !== undefined) resolved.width = w;
  if (h !== undefined) resolved.height = h;
  if (variant === 'circle' && w !== undefined && h === undefined) resolved.height = w;

  return (
    <span
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cx('tk-skeleton', `tk-skeleton--${variant}`, className)}
      style={resolved}
      {...rest}
    />
  );
};
