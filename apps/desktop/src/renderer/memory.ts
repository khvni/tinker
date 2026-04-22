import { extractConversationMemory, runDailyMemorySweep } from '@tinker/bridge';
import {
  applyMemoryUpdates,
  getMemoryRunState,
  runMemoryMaintenanceSweep,
  shouldRunDailySweep,
  type MemoryRunState,
  type MemoryWriteSummary,
} from '@tinker/memory';
import type { OpencodeConnection } from '../bindings.js';
import { createWorkspaceClient, getOpencodeDirectory } from './opencode.js';

export type ConversationMemoryInput = {
  observedOn: string;
  userMessage: string;
  assistantMessage: string;
  toolResults: Array<{ name: string; output: string }>;
};

export const readDailySweepState = async (): Promise<MemoryRunState> => {
  return getMemoryRunState('daily-sweep');
};

export const captureConversationMemory = async (
  connection: OpencodeConnection,
  vaultPath: string | null,
  input: ConversationMemoryInput,
): Promise<MemoryWriteSummary | null> => {
  if (!vaultPath) {
    return null;
  }

  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const payload = await extractConversationMemory(client, input);

  return applyMemoryUpdates(
    { path: vaultPath, isNew: false },
    payload.entities,
  );
};

export const runDailyMemorySweepIfDue = async (
  connection: OpencodeConnection,
  vaultPath: string | null,
  options?: { force?: boolean; observedOn?: string },
): Promise<{ changed: boolean; state: MemoryRunState }> => {
  const initialState = await readDailySweepState();
  if (!vaultPath) {
    return { changed: false, state: initialState };
  }

  if (!options?.force && !(await shouldRunDailySweep())) {
    return { changed: false, state: initialState };
  }

  const observedOn = options?.observedOn ?? new Date().toISOString().slice(0, 10);
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const maintenance = await runMemoryMaintenanceSweep({ path: vaultPath, isNew: false });
  const payload = await runDailyMemorySweep(client, observedOn);
  const result = await applyMemoryUpdates(
    { path: vaultPath, isNew: false },
    payload.entities,
    { runKey: 'daily-sweep' },
  );

  return {
    changed:
      maintenance.entitiesPruned > 0
      || result.appendedFacts > 0
      || result.created.length > 0
      || result.updated.length > 0,
    state: await readDailySweepState(),
  };
};
