import type { JSX } from 'react';
import type { SSOStatus } from '@tinker/shared-types';
import type { MCPStatus } from '../integrations.js';

type IntegrationsStripProps = {
  compact?: boolean;
  mcpStatus: Record<string, MCPStatus>;
  sessions: SSOStatus;
};

type IntegrationItem = {
  id: string;
  label: string;
  provider: 'google' | 'github' | 'linear';
};

const INTEGRATIONS: IntegrationItem[] = [
  { id: 'gmail', label: 'Gmail', provider: 'google' },
  { id: 'google-calendar', label: 'Calendar', provider: 'google' },
  { id: 'google-drive', label: 'Drive', provider: 'google' },
  { id: 'github', label: 'GitHub', provider: 'github' },
  { id: 'linear', label: 'Linear', provider: 'linear' },
];

const statusLabel = (status: MCPStatus | undefined, providerConnected: boolean): string => {
  if (!status) {
    return providerConnected ? 'Checking' : 'Not available';
  }

  switch (status.status) {
    case 'checking':
      return 'Checking';
    case 'connected':
      return 'Connected';
    case 'needs_auth':
      return 'Needs reconnect';
    case 'error':
    case 'failed':
      return 'Failed';
    case 'needs_client_registration':
      return 'Setup needed';
    case 'disabled':
    default:
      return providerConnected ? 'Standby' : 'Not available';
  }
};

const toneClass = (status: MCPStatus | undefined, providerConnected: boolean): string => {
  if (status?.status === 'connected') {
    return 'tinker-integration-chip--connected';
  }

  if (status?.status === 'needs_auth' || status?.status === 'needs_client_registration') {
    return 'tinker-integration-chip--warning';
  }

  if (status?.status === 'error' || status?.status === 'failed') {
    return 'tinker-integration-chip--error';
  }

  return providerConnected ? 'tinker-integration-chip--standby' : 'tinker-integration-chip--idle';
};

export const IntegrationsStrip = ({ compact = false, mcpStatus, sessions }: IntegrationsStripProps): JSX.Element => {
  return (
    <section className={`tinker-integrations-strip${compact ? ' tinker-integrations-strip--compact' : ''}`}>
      <div className="tinker-integrations-strip__header">
        <div>
          <p className="tinker-eyebrow">Integrations</p>
          {!compact ? <h3>Connected tools</h3> : null}
        </div>
        {!compact ? (
          <p className="tinker-muted">Google lights up Gmail, Calendar, Drive. GitHub lights up repo, issue, and PR tools.</p>
        ) : null}
      </div>

      <div className="tinker-integrations-strip__grid">
        {INTEGRATIONS.map((integration) => {
          const providerConnected =
            integration.provider === 'linear' ? false : sessions[integration.provider as 'google' | 'github'] !== null;
          const status = mcpStatus[integration.id];

          return (
            <article key={integration.id} className={`tinker-integration-chip ${toneClass(status, providerConnected)}`}>
              <div>
                <strong>{integration.label}</strong>
                {!compact ? (
                  <p className="tinker-muted">
                    {integration.provider === 'google'
                      ? 'Google'
                      : integration.provider === 'github'
                        ? 'GitHub'
                        : 'Optional env token'}
                  </p>
                ) : null}
              </div>
              <span>{statusLabel(status, providerConnected)}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
};
