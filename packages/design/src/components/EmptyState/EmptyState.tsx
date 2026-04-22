import type { JSX, ReactNode } from 'react';
import { cx } from '../cx.js';
import './EmptyState.css';

export type EmptyStateSize = 's' | 'm';

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  size?: EmptyStateSize;
  align?: 'center' | 'start';
  className?: string;
};

export const EmptyState = ({
  title,
  description,
  icon,
  action,
  size = 'm',
  align = 'center',
  className,
}: EmptyStateProps): JSX.Element => (
  <div
    className={cx(
      'tk-empty-state',
      `tk-empty-state--${size}`,
      `tk-empty-state--align-${align}`,
      className,
    )}
    role="status"
  >
    {icon != null ? <div className="tk-empty-state__icon" aria-hidden="true">{icon}</div> : null}
    <div className="tk-empty-state__text">
      <div className="tk-empty-state__title">{title}</div>
      {description != null ? (
        <p className="tk-empty-state__description">{description}</p>
      ) : null}
    </div>
    {action != null ? <div className="tk-empty-state__action">{action}</div> : null}
  </div>
);
