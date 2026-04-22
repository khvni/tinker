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
export const EXA_HEALTH_TIMEOUT_MS = 5_000;
export const EXA_HEALTH_TIMEOUT_MESSAGE = `Exa health check timed out after ${EXA_HEALTH_TIMEOUT_MS / 1_000}s.`;

export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Exa health check failed.';
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

export const checkExaBootHealth = async (
  loadStatus: () => Promise<MCPStatusResponse>,
  timeoutMs = EXA_HEALTH_TIMEOUT_MS,
): Promise<MCPStatus> => {
  try {
    const response = await withTimeout(loadStatus(), timeoutMs, `Exa health check timed out after ${timeoutMs / 1_000}s.`);
    if (response.data === undefined && response.error !== undefined) {
      return {
        status: 'error',
        error: formatErrorMessage(response.error),
      };
    }
    return normalizeExaBootStatus(response.data?.[EXA_MCP_NAME]);
  } catch (error) {
    return {
      status: 'error',
      error: formatErrorMessage(error),
    };
  }
};
