import { useCallback, useState, type JSX } from 'react';
import { Button, StatusDot, type StatusDotState } from '@tinker/design';
import type { OpencodeConnection } from '../../../../bindings.js';
import {
  BUILTIN_MCP_NAMES,
  type BuiltinMcpName,
  type MCPStatus,
} from '../../../integrations.js';
import { createWorkspaceClient, getOpencodeDirectory } from '../../../opencode.js';
import { useMcpStatusPolling } from '../useMcpStatusPolling.js';
import { AddToolPicker } from './AddToolPicker/index.js';
import './ConnectionsSection.css';

type ConnectionsSectionProps = {
  opencode: OpencodeConnection | null;
  vaultPath: string | null;
  memoryPath: string | null;
  seedStatuses?: Partial<Record<BuiltinMcpName, MCPStatus>> | undefined;
  /**
   * Fallback if the SDK `client.mcp.connect` call is unavailable or throws.
   * App.tsx owns the Tauri `restart_opencode` invocation — we do not redo it
   * here (see D22 — pass config per call, never stash on a manager).
   */
  onRequestRespawn: () => Promise<void>;
};

const MCP_LABELS: Readonly<Record<BuiltinMcpName, string>> = {
  qmd: 'qmd',
  'smart-connections': 'smart-connections',
  exa: 'exa',
};

const MCP_SUBTITLES: Readonly<Record<BuiltinMcpName, string>> = {
  qmd: 'Local markdown search over your memory folder.',
  'smart-connections': 'Semantic links between notes in your memory folder.',
  exa: 'Remote web search — no sign-in required.',
};

const getDotState = (status: MCPStatus['status']): StatusDotState => {
  switch (status) {
    case 'connected':
      return 'constructive';
    case 'reconnecting':
      return 'warning';
    case 'checking':
      return 'pulse';
    case 'disabled':
      return 'muted';
    case 'failed':
    case 'error':
    case 'needs_auth':
    case 'needs_client_registration':
      return 'danger';
  }
};

const getStatusLabel = (status: MCPStatus['status']): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'checking':
      return 'Checking…';
    case 'disabled':
      return 'Disabled';
    case 'needs_auth':
      return 'Needs sign-in';
    case 'needs_client_registration':
      return 'Setup needed';
    case 'failed':
    case 'error':
      return 'Failed';
  }
};

export const ConnectionsSection = ({
  opencode,
  vaultPath,
  memoryPath,
  seedStatuses,
  onRequestRespawn,
}: ConnectionsSectionProps): JSX.Element => {
  const { statuses, refresh, setRowStatus } = useMcpStatusPolling({
    connection: opencode,
    vaultPath,
    memoryPath,
    seedStatuses,
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleRetry = useCallback(
    async (name: BuiltinMcpName): Promise<void> => {
      // Retry requires a live OpenCode connection — without one we cannot
      // call `mcp.connect` nor meaningfully respawn the sidecar. Surface the
      // blocker on the row instead of silently flipping through reconnecting
      // and back. Caller can sign-in / wait for the boot effect to resolve.
      if (opencode === null) {
        setRowStatus(name, {
          status: 'failed',
          error: 'OpenCode is not connected yet.',
        });
        return;
      }

      setRowStatus(name, { status: 'reconnecting' });

      let sdkHandled = false;
      try {
        const directory = getOpencodeDirectory(vaultPath);
        const client = createWorkspaceClient(opencode, directory);
        // `client.mcp.connect` may be undefined against an older sidecar
        // build — fall through to respawn when that happens.
        const connect = client.mcp?.connect?.bind(client.mcp);
        if (typeof connect === 'function') {
          await connect({ name });
          sdkHandled = true;
        }
      } catch (error) {
        // Fall back to full respawn — see onRequestRespawn prop comment.
        console.warn(`mcp.connect(${name}) failed, falling back to respawn.`, error);
        sdkHandled = false;
      }

      if (!sdkHandled) {
        try {
          await onRequestRespawn();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Retry failed.';
          setRowStatus(name, { status: 'failed', error: message });
          return;
        }
      }

      await refresh();
    },
    [onRequestRespawn, opencode, refresh, setRowStatus, vaultPath],
  );

  return (
    <section className="tinker-connections-section" aria-labelledby="tinker-connections-heading">
      <header className="tinker-connections-section__header">
        <div>
          <p className="tinker-eyebrow">Connections</p>
          <h3 id="tinker-connections-heading">Built-in tools</h3>
        </div>
        <p className="tinker-muted tinker-connections-section__blurb">
          These three MCP servers ship pre-wired. Sign-in-gated connectors show up after you add them.
        </p>
      </header>

      <ul className="tinker-connections-section__rows" role="list">
        {BUILTIN_MCP_NAMES.map((name) => {
          const status = statuses[name];
          const rowState = getDotState(status.status);
          const showRetry = status.status !== 'connected' && status.status !== 'checking';
          const subtitle =
            status.status === 'connected'
              ? MCP_SUBTITLES[name]
              : (status.error ?? getStatusLabel(status.status));

          return (
            <li key={name} className="tinker-connections-section__row">
              <div className="tinker-connections-section__row-identity">
                <StatusDot
                  state={rowState}
                  label={`${MCP_LABELS[name]} status: ${getStatusLabel(status.status)}`}
                />
                <div className="tinker-connections-section__row-text">
                  <p className="tinker-connections-section__row-title">{MCP_LABELS[name]}</p>
                  <p className="tinker-muted tinker-connections-section__row-subtitle">{subtitle}</p>
                </div>
              </div>

              {showRetry ? (
                <Button
                  variant="secondary"
                  size="s"
                  onClick={() => void handleRetry(name)}
                  disabled={status.status === 'reconnecting'}
                >
                  {status.status === 'reconnecting' ? 'Retrying…' : 'Retry'}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="tinker-connections-section__add">
        <Button
          variant="secondary"
          leadingIcon={<span aria-hidden="true">+</span>}
          onClick={() => setPickerOpen(true)}
        >
          Add tool
        </Button>
      </div>

      <AddToolPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </section>
  );
};
