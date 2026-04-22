import type { JSX } from 'react';
import { Badge, Button } from '@tinker/design';
import './ModelSection.css';

export type ModelSectionProps = {
  readonly nativeRuntimeAvailable: boolean;
  readonly modelConnected: boolean;
  readonly modelAuthBusy: boolean;
  readonly modelAuthMessage: string | null;
  readonly onConnectModel: () => Promise<void>;
  readonly onDisconnectModel: () => Promise<void>;
};

export const ModelSection = ({
  nativeRuntimeAvailable,
  modelConnected,
  modelAuthBusy,
  modelAuthMessage,
  onConnectModel,
  onDisconnectModel,
}: ModelSectionProps): JSX.Element => {
  return (
    <section className="tk-model-section" aria-labelledby="settings-model-title">
      <div className="tk-model-section__summary">
        <div className="tk-account-section__name-row">
          <h2 id="settings-model-title" className="tk-account-section__name">
            AI model
          </h2>
          <Badge variant={modelConnected ? 'success' : 'default'} size="small">
            {modelConnected ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
        <p className="tk-model-section__message tinker-muted">
          Tinker routes chat through OpenCode. Connect an AI model to start sending messages — your
          provider keys stay with OpenCode on this device.
        </p>
        <div className="tk-model-section__actions">
          {modelConnected ? (
            <Button
              variant="secondary"
              size="m"
              disabled={!nativeRuntimeAvailable || modelAuthBusy}
              onClick={() => {
                void onDisconnectModel();
              }}
            >
              {modelAuthBusy ? 'Disconnecting…' : 'Disconnect model'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="m"
              disabled={!nativeRuntimeAvailable || modelAuthBusy}
              onClick={() => {
                void onConnectModel();
              }}
            >
              {modelAuthBusy ? 'Connecting…' : 'Connect model'}
            </Button>
          )}
        </div>
        {modelAuthMessage ? (
          <p className="tk-model-section__message tinker-muted" role="status">
            {modelAuthMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
};
