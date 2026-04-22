import type { HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import { ConnectionGate, type ConnectionService } from './ConnectionGate.js';
import './ConnectionSplash.css';

export type ConnectionSplashProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> & {
  services: ReadonlyArray<ConnectionService>;
  title?: string;
  subtitle?: string;
  wordmark?: string;
};

const TinkerMark = () => (
  <svg
    className="tk-connection-splash__mark"
    viewBox="0 0 48 48"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="4" y="4" width="40" height="40" rx="10" fill="var(--color-accent)" />
    <path
      d="M17 18h14M24 18v13"
      stroke="var(--color-accent-ink)"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const Spinner = () => (
  <svg
    className="tk-connection-splash__spinner"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="var(--color-border-subtle)"
      strokeWidth="2"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const ConnectionSplash = ({
  services,
  title = 'Starting Tinker…',
  subtitle,
  wordmark = 'Tinker',
  className,
  ...rest
}: ConnectionSplashProps) => (
  <div
    className={cx('tk-connection-splash', className)}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    {...rest}
  >
    <div className="tk-connection-splash__card">
      <div className="tk-connection-splash__brand">
        <TinkerMark />
        <span className="tk-connection-splash__wordmark">{wordmark}</span>
      </div>

      <div className="tk-connection-splash__header">
        <Spinner />
        <div className="tk-connection-splash__copy">
          <p className="tk-connection-splash__title">{title}</p>
          {subtitle ? <p className="tk-connection-splash__subtitle">{subtitle}</p> : null}
        </div>
      </div>

      <ConnectionGate services={services} title={null} />
    </div>
  </div>
);
