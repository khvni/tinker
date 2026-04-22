import type { JSX } from 'react';
import { EmptyState } from '@tinker/design';
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
  const anyProviderConnected =
    sessions.google !== null ||
    sessions.github !== null ||
    Object.values(mcpStatus).some((status) => status.status !== 'disabled');

  return (
    <section className={`tinker-integrations-strip${compact ? ' tinker-integrations-strip--compact' : ''}`}>
      <div className="tinker-integrations-strip__header">
        <div>
          <p className="tinker-eyebrow">Integrations</p>
          {!compact ? <h3>Connected tools</h3> : null}
        </div>
        {!compact ? (
          <p className="tinker-muted">
            Google lights up Gmail, Calendar, and Drive. GitHub uses your Tinker sign-in. Linear can authenticate on
            first use or via API key.
          </p>
        ) : null}
      </div>

      {!anyProviderConnected && !compact ? (
        <EmptyState
          title="No connections yet"
          description="Sign in with Google or GitHub, or authenticate Linear on first use. Tinker still works as a local coding agent without them."
          size="s"
          align="start"
          icon={
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10 14a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 1 0-5.66-5.66L11 7.34"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 10a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66L13 16.66"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      ) : null}

      <div className="tinker-integrations-strip__grid">
        {INTEGRATIONS.map((integration) => {
          const status = mcpStatus[integration.id];
          const providerConnected =
            integration.provider === 'linear'
              ? status !== undefined && status.status !== 'disabled'
              : sessions[integration.provider as 'google' | 'github'] !== null;

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
                        : 'OAuth or API key'}
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
