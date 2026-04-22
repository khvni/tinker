import type { SSOSession } from '@tinker/shared-types';

export type MCPStatus = {
  status:
    | 'checking'
    | 'connected'
    | 'disabled'
    | 'error'
    | 'failed'
    | 'needs_auth'
    | 'needs_client_registration'
    | 'reconnecting';
  error?: string;
};

export const BUILTIN_MCP_NAMES = ['qmd', 'smart-connections', 'exa'] as const;
export type BuiltinMcpName = (typeof BUILTIN_MCP_NAMES)[number];

const QMD_MISSING_MEMORY_PATH_HINT =
  'SMART_VAULT_PATH is not set. Pick a memory folder in Settings so qmd can index your notes.';
const SMART_CONNECTIONS_MISSING_MEMORY_PATH_HINT =
  'SMART_VAULT_PATH is not set. Pick a memory folder in Settings so smart-connections can embed your notes.';
const EXA_NETWORK_HINT = 'Network error reaching exa. Check your connection and try again.';

const GENERIC_CONNECTING_FALLBACK = 'Waiting for OpenCode to report MCP status…';

type NormalizeMcpStatusArgs = {
  name: string;
  raw: MCPStatusLike | undefined;
  memoryPath: string | null;
};

export const normalizeMcpRowStatus = ({ name, raw, memoryPath }: NormalizeMcpStatusArgs): MCPStatus => {
  if (raw === undefined) {
    return { status: 'checking' };
  }

  const statusValue = raw.status?.trim();
  if (statusValue === 'connected') {
    return { status: 'connected' };
  }

  const rawError = raw.error?.trim();

  if (statusValue === 'failed' || statusValue === 'error') {
    return {
      status: 'failed',
      error: rawError && rawError.length > 0 ? rawError : deriveDefaultError(name, memoryPath),
    };
  }

  if (statusValue === 'needs_auth') {
    return rawError && rawError.length > 0
      ? { status: 'needs_auth', error: rawError }
      : { status: 'needs_auth' };
  }

  if (statusValue === 'needs_client_registration') {
    return {
      status: 'needs_client_registration',
      error: rawError && rawError.length > 0 ? rawError : 'MCP server needs client registration.',
    };
  }

  if (statusValue === 'disabled') {
    return { status: 'disabled' };
  }

  if (statusValue === 'checking' || statusValue === 'reconnecting') {
    return { status: statusValue };
  }

  if (rawError && rawError.length > 0) {
    return { status: 'failed', error: rawError };
  }

  return { status: 'checking', error: GENERIC_CONNECTING_FALLBACK };
};

const deriveDefaultError = (name: string, memoryPath: string | null): string => {
  if (name === 'qmd' && !memoryPath) {
    return QMD_MISSING_MEMORY_PATH_HINT;
  }
  if (name === 'smart-connections' && !memoryPath) {
    return SMART_CONNECTIONS_MISSING_MEMORY_PATH_HINT;
  }
  if (name === 'exa') {
    return EXA_NETWORK_HINT;
  }
  return 'MCP server failed to connect.';
};

type MCPStatusLike = {
  status?: string;
  error?: string;
};

type MCPStatusResponse = {
  data?: Record<string, MCPStatusLike | undefined> | undefined;
  error?: unknown;
};

export const EXA_MCP_NAME = 'exa';
export const GITHUB_MCP_NAME = 'github';
export const LINEAR_MCP_NAME = 'linear';
export const TRACKED_MCP_NAMES = [EXA_MCP_NAME, GITHUB_MCP_NAME, LINEAR_MCP_NAME] as const;
export const MCP_HEALTH_TIMEOUT_MS = 5_000;
export const EXA_HEALTH_TIMEOUT_MS = MCP_HEALTH_TIMEOUT_MS;
export const EXA_HEALTH_TIMEOUT_MESSAGE = `Exa health check timed out after ${EXA_HEALTH_TIMEOUT_MS / 1_000}s.`;
export const EXA_CHECKING_STATUS: MCPStatus = { status: 'checking' };
export const GITHUB_RECONNECT_MESSAGE = 'Reconnect GitHub to grant repository access before using GitHub MCP tools.';

const formatErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallbackMessage;
};

const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      operation.then(resolve, reject);
    });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

export const normalizeExaBootStatus = (status: MCPStatusLike | undefined): MCPStatus => {
  if (status?.status === 'connected') {
    return { status: 'connected' };
  }

  const error = status?.error?.trim();
  if (error) {
    return { status: 'error', error };
  }

  if (!status?.status) {
    return { status: 'error', error: 'Exa did not report a connection status.' };
  }

  return {
    status: 'error',
    error: `Exa reported "${status.status}" instead of "connected".`,
  };
};

const normalizeTrackedMcpStatus = (name: string, status: MCPStatusLike | undefined): MCPStatus => {
  if (!status?.status) {
    return { status: 'disabled' };
  }

  const error = status.error?.trim();
  switch (status.status) {
    case 'checking':
    case 'connected':
    case 'disabled':
    case 'error':
    case 'failed':
    case 'needs_auth':
    case 'needs_client_registration':
      return error ? { status: status.status, error } : { status: status.status };
    default:
      return {
        status: 'error',
        error: error ?? `${name} reported an unknown status "${status.status}".`,
      };
  }
};

export const githubSessionNeedsReconnect = (session: SSOSession | null | undefined): boolean => {
  if (!session) {
    return false;
  }

  return !session.scopes.some((scope) => {
    const normalized = scope.trim();
    return normalized === 'repo' || normalized === 'public_repo';
  });
};

export const resolveTrackedMcpStatuses = (
  data: MCPStatusResponse['data'],
  githubSession: SSOSession | null | undefined,
): Record<string, MCPStatus> => {
  const statuses: Record<string, MCPStatus> = {
    [EXA_MCP_NAME]: normalizeExaBootStatus(data?.[EXA_MCP_NAME]),
    [GITHUB_MCP_NAME]: normalizeTrackedMcpStatus('GitHub', data?.[GITHUB_MCP_NAME]),
    [LINEAR_MCP_NAME]: normalizeTrackedMcpStatus('Linear', data?.[LINEAR_MCP_NAME]),
  };

  if (githubSessionNeedsReconnect(githubSession)) {
    statuses[GITHUB_MCP_NAME] = {
      status: 'needs_auth',
      error: GITHUB_RECONNECT_MESSAGE,
    };
  }

  return statuses;
};

export const checkExaBootHealth = async (
  loadStatus: () => Promise<MCPStatusResponse>,
  timeoutMs = EXA_HEALTH_TIMEOUT_MS,
): Promise<MCPStatus> => {
  try {
    const response = await withTimeout(loadStatus(), timeoutMs, `Exa health check timed out after ${timeoutMs / 1_000}s.`);
    if (response.data === undefined && response.error !== undefined) {
      return {
        status: 'error',
        error: formatErrorMessage(response.error, 'Exa health check failed.'),
      };
    }
    return normalizeExaBootStatus(response.data?.[EXA_MCP_NAME]);
  } catch (error) {
    return {
      status: 'error',
      error: formatErrorMessage(error, 'Exa health check failed.'),
    };
  }
};

export const checkTrackedMcpBootHealth = async (
  loadStatus: () => Promise<MCPStatusResponse>,
  githubSession: SSOSession | null | undefined,
  timeoutMs = MCP_HEALTH_TIMEOUT_MS,
): Promise<Record<string, MCPStatus>> => {
  try {
    const response = await withTimeout(loadStatus(), timeoutMs, `MCP health check timed out after ${timeoutMs / 1_000}s.`);
    if (response.data === undefined && response.error !== undefined) {
      const error = formatErrorMessage(response.error, 'MCP health check failed.');
      return Object.fromEntries(TRACKED_MCP_NAMES.map((name) => [name, { status: 'error', error }])) as Record<
        string,
        MCPStatus
      >;
    }

    return resolveTrackedMcpStatuses(response.data, githubSession);
  } catch (error) {
    const message = formatErrorMessage(error, 'MCP health check failed.');
    return Object.fromEntries(TRACKED_MCP_NAMES.map((name) => [name, { status: 'error', error: message }])) as Record<
      string,
      MCPStatus
    >;
  }
};
