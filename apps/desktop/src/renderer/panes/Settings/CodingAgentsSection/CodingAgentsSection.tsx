import { type JSX } from 'react';
import { StatusDot, type StatusDotState } from '@tinker/design';
import type {
  AcpConnectorState,
  GooseConnection,
} from '@tinker/shared-types';
import './CodingAgentsSection.css';

type CodingAgentsSectionProps = {
  /** Whether the Goose runtime is detected and reachable. */
  readonly gooseInstalled: boolean;
  /** Connection info for the running Goose process (null when not running). */
  readonly gooseConnection: GooseConnection | null;
  /** Current state of each ACP agent from registry discovery. */
  readonly connectorStates: ReadonlyArray<AcpConnectorState>;
  /** Path to the registry.json file (shown in UI for user reference). */
  readonly registryPath?: string;
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
  registryPath,
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
          <h3 id="tinker-coding-agents-heading">ACP Registry</h3>
        </div>
        <p className="tinker-muted tinker-coding-agents-section__blurb">
          Agents are discovered from your local ACP registry. Any binary that
          speaks JSON-RPC over stdio can be added.
          {registryPath ? (
            <span className="tinker-coding-agents-section__registry-path">
              {' '}Registry: <code>{registryPath}</code>
            </span>
          ) : null}
        </p>
      </header>

      {/* Goose runtime status */}
      <div className="tinker-coding-agents-section__goose-status">
        <StatusDot state={gooseDot} label={gooseLabel} />
        <span>{gooseLabel}</span>
      </div>

      {/* Agent rows — dynamically populated from registry */}
      <ul className="tinker-coding-agents-section__rows" role="list">
        {connectorStates.map((state) => {
          const dotState = statusToDotState(state.status);
          const label = statusToLabel(state.status);
          const subtitle =
            state.status === 'configured'
              ? state.description
              : (state.message ?? state.description);

          return (
            <li key={state.id} className="tinker-coding-agents-section__row">
              <div className="tinker-coding-agents-section__row-identity">
                <StatusDot state={dotState} label={label} />
                <div className="tinker-coding-agents-section__row-text">
                  <p className="tinker-coding-agents-section__row-title">
                    {state.name}
                  </p>
                  <p className="tinker-coding-agents-section__row-subtitle tinker-muted">
                    {subtitle}
                  </p>
                  {state.status === 'not-installed' && state.cmd ? (
                    <p className="tinker-coding-agents-section__hint">
                      Binary: <code>{state.cmd}</code>
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

      {connectorStates.length === 0 ? (
        <p className="tinker-coding-agents-section__hint">
          No agents registered. Add entries to your registry.json to get started.
        </p>
      ) : null}
    </section>
  );
};
