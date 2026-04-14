import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { OpencodeConnection } from '../bindings.js';

export const OPENCODE_OPENAI_PROVIDER_ID = 'openai';

export const getOpencodeDirectory = (vaultPath: string | null): string | undefined => {
  return vaultPath ?? undefined;
};

const getAuthorizationHeader = (connection: OpencodeConnection): string => {
  return `Basic ${btoa(`${connection.username}:${connection.password}`)}`;
};

export const createWorkspaceClient = (connection: OpencodeConnection, directory?: string) => {
  return createOpencodeClient({
    baseUrl: connection.baseUrl,
    headers: {
      Authorization: getAuthorizationHeader(connection),
    },
    ...(directory ? { directory } : {}),
  });
};
