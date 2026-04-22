import type { HTMLAttributes } from 'react';
import { cx } from '../cx.js';
import { StatusDot, type StatusDotState } from '../StatusDot.js';
import './ConnectionGate.css';

export type ConnectionServiceStatus = 'pending' | 'connected' | 'error';

export type ConnectionService = {
  id: string;
  label: string;
  status: ConnectionServiceStatus;
  detail?: string;
};

export type ConnectionGateProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> & {
  services: ReadonlyArray<ConnectionService>;
  title?: string | null;
};

const dotStateFor = (status: ConnectionServiceStatus): StatusDotState => {
  switch (status) {
    case 'connected':
      return 'constructive';
    case 'error':
      return 'danger';
    case 'pending':
      return 'pulse';
  }
};

const statusLabel = (status: ConnectionServiceStatus): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Failed';
    case 'pending':
      return 'Connecting…';
  }
};

export const ConnectionGate = ({
  services,
  title = 'Connecting…',
  className,
  ...rest
}: ConnectionGateProps) => (
  <div
    className={cx('tk-connection-gate', className)}
    role="status"
    aria-live="polite"
    aria-busy={services.some((s) => s.status === 'pending')}
    {...rest}
  >
    {title ? <p className="tk-connection-gate__title">{title}</p> : null}
    <ul className="tk-connection-gate__list">
      {services.map((service) => (
        <li
          key={service.id}
          className={cx(
            'tk-connection-gate__row',
            `tk-connection-gate__row--${service.status}`,
          )}
          data-service-id={service.id}
        >
          <StatusDot state={dotStateFor(service.status)} label={statusLabel(service.status)} />
          <span className="tk-connection-gate__label">{service.label}</span>
          <span className="tk-connection-gate__status">
            {service.detail ?? statusLabel(service.status)}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
