import { extractConversationMemory, runDailyMemorySweep } from '@tinker/bridge';
import {
  applyMemoryUpdates,
  getMemoryRunState,
  runMemoryMaintenanceSweep,
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

export type DailyMemorySweepSummary = {
  entitiesIndexed: number;
  entitiesFlagged: number;
  appendedFacts: number;
  created: number;
  updated: number;
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

export const runDailyMemorySweepNow = async (
  connection: OpencodeConnection,
  vaultPath: string,
  options?: { observedOn?: string },
): Promise<DailyMemorySweepSummary> => {
  const observedOn = options?.observedOn ?? new Date().toISOString().slice(0, 10);
  const client = createWorkspaceClient(connection, getOpencodeDirectory(vaultPath));
  const maintenance = await runMemoryMaintenanceSweep({ path: vaultPath, isNew: false });
  const payload = await runDailyMemorySweep(client, observedOn);
  const writes = await applyMemoryUpdates(
    { path: vaultPath, isNew: false },
    payload.entities,
    { runKey: 'daily-sweep' },
  );

  return {
    entitiesIndexed: maintenance.entitiesIndexed,
    entitiesFlagged: maintenance.entitiesFlagged,
    appendedFacts: writes.appendedFacts,
    created: writes.created.length,
    updated: writes.updated.length,
  };
};

export const formatDailyMemorySweepSummary = (summary: DailyMemorySweepSummary): string => {
  const { entitiesIndexed, entitiesFlagged, appendedFacts, created, updated } = summary;
  return [
    `Indexed ${entitiesIndexed} entities; flagged ${entitiesFlagged} stale.`,
    `Appended ${appendedFacts} facts (${created} new, ${updated} updated).`,
  ].join(' ');
};
