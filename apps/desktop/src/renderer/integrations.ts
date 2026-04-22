export type MCPStatus = {
  status:
    | 'checking'
    | 'connected'
    | 'disabled'
    | 'error'
    | 'failed'
    | 'needs_auth'
    | 'needs_client_registration';
  error?: string;
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
export const EXA_CHECKING_STATUS: MCPStatus = { status: 'checking' };

const formatErrorMessage = (error: unknown): string => {
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
