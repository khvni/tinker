import { useEffect, useMemo, useState } from 'react';
import type { ConnectionService } from '@tinker/design';

type McpStatusLike = {
  status?: string;
  error?: string;
};

type McpStatusResponse = {
  data?: Record<string, McpStatusLike | undefined> | undefined;
  error?: unknown;
};

type UseMcpConnectionGateOptions = {
  enabled: boolean;
  loadStatus(): Promise<McpStatusResponse>;
  timeoutMs?: number;
  pollIntervalMs?: number;
};

type McpConnectionGatePhase = 'idle' | 'checking' | 'ready' | 'error' | 'timed_out' | 'skipped';

type McpConnectionGateState = {
  blocked: boolean;
  errorMessage: string | null;
  notice: string | null;
  services: ReadonlyArray<ConnectionService>;
  visible: boolean;
  retry(): void;
  skip(): void;
};

const MCP_GATE_TIMEOUT_MS = 10_000;
const MCP_GATE_POLL_INTERVAL_MS = 500;
const MCP_GATE_TIMEOUT_MESSAGE = 'Tools took longer than 10 seconds. Composer enabled anyway.';
const MCP_GATE_SKIPPED_MESSAGE = 'Skipped tool check for now. Composer enabled while qmd, smart-connections, and exa reconnect.';
const MCP_REQUEST_TIMEOUT_MESSAGE = '__mcp_connection_gate_timeout__';

const BUILTIN_MCP_SERVICES = [
  { id: 'qmd', label: 'qmd' },
  { id: 'smart-connections', label: 'smart-connections' },
  { id: 'exa', label: 'exa' },
] as const;

const buildPendingServices = (): ConnectionService[] => {
  return BUILTIN_MCP_SERVICES.map((service) => ({
    ...service,
    status: 'pending',
  }));
};

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Could not read MCP connection status.';
};

const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  let timeoutId: number | null = null;

  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      operation.then(resolve, reject);
    });
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const normalizeService = (
  id: string,
  label: string,
  status: McpStatusLike | undefined,
): ConnectionService => {
  if (status?.status === 'connected') {
    return { id, label, status: 'connected' };
  }

  const detail = status?.error?.trim();
  if (detail) {
    return { id, label, status: 'error', detail };
  }

  if (
    status?.status === 'error'
    || status?.status === 'failed'
    || status?.status === 'disabled'
    || status?.status === 'needs_auth'
    || status?.status === 'needs_client_registration'
  ) {
    return {
      id,
      label,
      status: 'error',
      detail: `OpenCode reported "${status.status}".`,
    };
  }

  return { id, label, status: 'pending' };
};

const normalizeServices = (response: McpStatusResponse): ConnectionService[] => {
  return BUILTIN_MCP_SERVICES.map((service) =>
    normalizeService(service.id, service.label, response.data?.[service.id]),
  );
};

const wait = (durationMs: number): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
};

export const useMcpConnectionGate = ({
  enabled,
  loadStatus,
  timeoutMs = MCP_GATE_TIMEOUT_MS,
  pollIntervalMs = MCP_GATE_POLL_INTERVAL_MS,
}: UseMcpConnectionGateOptions): McpConnectionGateState => {
  const [phase, setPhase] = useState<McpConnectionGatePhase>('idle');
  const [services, setServices] = useState<ReadonlyArray<ConnectionService>>(buildPendingServices);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSkipped(false);
      setPhase('idle');
      setServices(buildPendingServices());
      setErrorMessage(null);
      setNotice(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || skipped) {
      if (enabled && skipped) {
        setPhase('skipped');
      }
      return;
    }

    let cancelled = false;
    const deadline = Date.now() + timeoutMs;

    setPhase('checking');
    setServices(buildPendingServices());
    setErrorMessage(null);
    setNotice(null);

    void (async () => {
      while (!cancelled) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          setPhase('timed_out');
          setNotice(MCP_GATE_TIMEOUT_MESSAGE);
          return;
        }

        try {
          const response = await withTimeout(loadStatus(), remainingMs, MCP_REQUEST_TIMEOUT_MESSAGE);
          if (cancelled) {
            return;
          }

          if (response.data === undefined && response.error !== undefined) {
            setPhase('error');
            setErrorMessage(formatErrorMessage(response.error));
            return;
          }

          const nextServices = normalizeServices(response);
          setServices(nextServices);

          const failedService = nextServices.find((service) => service.status === 'error');
          if (failedService) {
            setPhase('error');
            setErrorMessage(failedService.detail ?? `${failedService.label} failed to connect.`);
            return;
          }

          if (nextServices.every((service) => service.status === 'connected')) {
            setPhase('ready');
            return;
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          if (error instanceof Error && error.message === MCP_REQUEST_TIMEOUT_MESSAGE) {
            setPhase('timed_out');
            setNotice(MCP_GATE_TIMEOUT_MESSAGE);
            return;
          }

          setPhase('error');
          setErrorMessage(formatErrorMessage(error));
          return;
        }

        await wait(pollIntervalMs);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, loadStatus, pollIntervalMs, retryCount, skipped, timeoutMs]);

  return useMemo(
    () => ({
      blocked: enabled && (phase === 'checking' || phase === 'error'),
      errorMessage,
      notice,
      services,
      visible: enabled && (phase === 'checking' || phase === 'error'),
      retry: () => {
        setSkipped(false);
        setRetryCount((current) => current + 1);
      },
      skip: () => {
        setSkipped(true);
        setErrorMessage(null);
        setNotice(MCP_GATE_SKIPPED_MESSAGE);
      },
    }),
    [enabled, errorMessage, notice, phase, services],
  );
};
