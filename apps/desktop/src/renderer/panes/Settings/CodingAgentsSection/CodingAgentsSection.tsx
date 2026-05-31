import { type JSX } from 'react';
import { StatusDot, type StatusDotState } from '@tinker/design';
import {
  ACP_CONNECTOR_META,
  type AcpConnectorState,
  type GooseConnection,
} from '@tinker/shared-types';
import './CodingAgentsSection.css';

type CodingAgentsSectionProps = {
  /** Whether the Goose runtime is detected and reachable. */
  readonly gooseInstalled: boolean;
  /** Connection info for the running Goose process (null when not running). */
  readonly gooseConnection: GooseConnection | null;
  /** Current state of each ACP coding-agent connector. */
  readonly connectorStates: ReadonlyArray<AcpConnectorState>;
};

const statusToDotState = (status: AcpConnectorState['status']): StatusDotState => {
  switch (status) {
    case 'configured':
      return 'constructive';
    case 'detected':
      return 'info';
    case 'not-installed':
      return 'muted';
    case 'unavailable':
      return 'warning';
    case 'errored':
      return 'danger';
  }
};

const statusToLabel = (status: AcpConnectorState['status']): string => {
  switch (status) {
    case 'configured':
      return 'Configured';
    case 'detected':
      return 'Detected';
    case 'not-installed':
      return 'Not installed';
    case 'unavailable':
      return 'Unavailable';
    case 'errored':
      return 'Error';
  }
};

export const CodingAgentsSection = ({
  gooseInstalled,
  gooseConnection,
  connectorStates,
}: CodingAgentsSectionProps): JSX.Element => {
  const gooseDot: StatusDotState =
    gooseConnection !== null ? 'constructive' : gooseInstalled ? 'warning' : 'danger';
  const gooseLabel =
    gooseConnection !== null
      ? 'Goose running'
      : gooseInstalled
        ? 'Goose installed but not running'
        : 'Goose not installed';

  return (
    <section
      className="tinker-coding-agents-section"
      aria-labelledby="tinker-coding-agents-heading"
    >
      <header className="tinker-coding-agents-section__header">
        <div>
          <p className="tinker-eyebrow">Coding Agents</p>
          <h3 id="tinker-coding-agents-heading">ACP connectors</h3>
        </div>
        <p className="tinker-muted tinker-coding-agents-section__blurb">
          Goose can delegate coding tasks to these agents via ACP. Install and
          configure them to unlock agent-assisted coding.
        </p>
      </header>

      {/* Goose runtime status */}
      <div className="tinker-coding-agents-section__goose-status">
        <StatusDot state={gooseDot} label={gooseLabel} />
        <span>{gooseLabel}</span>
      </div>

      {/* Connector rows */}
      <ul className="tinker-coding-agents-section__rows" role="list">
        {ACP_CONNECTOR_META.map((meta) => {
          const state = connectorStates.find((s) => s.id === meta.id);
          const status = state?.status ?? 'unavailable';
          const dotState = statusToDotState(status);
          const label = statusToLabel(status);
          const subtitle =
            status === 'configured'
              ? meta.description
              : (state?.message ?? meta.description);
          const showHint = status === 'not-installed';

          return (
            <li key={meta.id} className="tinker-coding-agents-section__row">
              <div className="tinker-coding-agents-section__row-identity">
                <StatusDot state={dotState} label={label} />
                <div className="tinker-coding-agents-section__row-text">
                  <p className="tinker-coding-agents-section__row-title">
                    {meta.label}
                  </p>
                  <p className="tinker-coding-agents-section__row-subtitle tinker-muted">
                    {subtitle}
                  </p>
                  {showHint ? (
                    <p className="tinker-coding-agents-section__hint">
                      {meta.installHint}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="tinker-muted" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      {!gooseInstalled ? (
        <p className="tinker-coding-agents-section__hint">
          curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash
        </p>
      ) : null}
    </section>
  );
};
