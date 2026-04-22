import type { JSX } from 'react';
import { Button, ConnectionGate, type ConnectionService } from '@tinker/design';
import './McpConnectionGate.css';

type McpConnectionGateProps = {
  services: ReadonlyArray<ConnectionService>;
  errorMessage?: string | null;
  onRetry(): void;
  onSkip(): void;
};

export const McpConnectionGate = ({
  services,
  errorMessage = null,
  onRetry,
  onSkip,
}: McpConnectionGateProps): JSX.Element => {
  return (
    <section className="tinker-chat-mcp-gate" aria-label="Tool connection gate">
      <ConnectionGate services={services} title={errorMessage ? 'Tool connection stalled' : 'Connecting tools…'} />
      <p className="tinker-chat-mcp-gate__copy">
        {errorMessage ?? 'Waiting for qmd, smart-connections, and exa before enabling the composer.'}
      </p>
      {errorMessage ? (
        <div className="tinker-chat-mcp-gate__actions">
          <Button variant="secondary" size="s" onClick={onRetry}>
            Retry
          </Button>
          <Button variant="ghost" size="s" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      ) : null}
    </section>
  );
};
