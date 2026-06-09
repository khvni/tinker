/**
 * In-process run manager for host-service.
 *
 * A "run" is a single prompt→response cycle (or a long-running agent task)
 * that the host tracks on behalf of the renderer. The renderer never talks
 * to the agent backend directly — it creates / prompts / aborts runs through
 * host-service endpoints, and receives normalized `RunEvent` objects via SSE.
 *
 * Today the backend is OpenCode (HTTP + SSE via `@opencode-ai/sdk`). When
 * Goose replaces it, only this file changes — the endpoint contract and the
 * `RunEvent` shape stay the same.
 */

import type {
  AbortRunRequest,
  ApprovalResponse,
  CreateRunRequest,
  PromptRunRequest,
  Run,
  RunEvent,
  RunStatus,
  StoredRunEvent,
} from '@tinker/shared-types';

/** Callback that receives normalized run events as they arrive. */
export type RunEventListener = (event: RunEvent) => void;

// Re-export so existing consumers of `@tinker/host-service` don't break.
export type { StoredRunEvent } from '@tinker/shared-types';

type ManagedRun = {
  run: Run;
  listeners: Set<RunEventListener>;
  eventLog: StoredRunEvent[];
  abortController: AbortController | null;
};

export type RunManager = {
  create(request: CreateRunRequest): Run;
  get(runId: string): Run | null;
  list(): Run[];
  prompt(request: PromptRunRequest): void;
  abort(request: AbortRunRequest): void;
  respondToApproval(response: ApprovalResponse): void;
  subscribe(runId: string, listener: RunEventListener): () => void;
  getEventLog(runId: string): StoredRunEvent[];
};

let nextRunCounter = 0;

const generateRunId = (): string => {
  nextRunCounter += 1;
  return `run-${Date.now()}-${nextRunCounter}`;
};

const now = (): string => new Date().toISOString();

export const createRunManager = (): RunManager => {
  const runs = new Map<string, ManagedRun>();

  const emit = (runId: string, event: RunEvent): void => {
    const managed = runs.get(runId);
    if (!managed) return;

    managed.eventLog.push({ ts: now(), event });
    for (const listener of managed.listeners) {
      try {
        listener(event);
      } catch {
        // listener errors must not break the event loop
      }
    }
  };

  const updateStatus = (runId: string, status: RunStatus): void => {
    const managed = runs.get(runId);
    if (!managed) return;
    managed.run = { ...managed.run, status, updatedAt: now() };
    emit(runId, { type: 'status_changed', status });
  };

  const create = (request: CreateRunRequest): Run => {
    const id = generateRunId();
    const timestamp = now();
    const run: Run = {
      id,
      title: request.title ?? 'Untitled run',
      status: 'active',
      projectPath: request.projectPath ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      modelID: request.modelID ?? null,
      providerID: request.providerID ?? null,
    };

    runs.set(id, {
      run,
      listeners: new Set(),
      eventLog: [],
      abortController: null,
    });

    return run;
  };

  const get = (runId: string): Run | null => {
    return runs.get(runId)?.run ?? null;
  };

  const list = (): Run[] => {
    return [...runs.values()].map((managed) => managed.run);
  };

  const prompt = (request: PromptRunRequest): void => {
    const managed = runs.get(request.runId);
    if (!managed) return;

    const controller = new AbortController();
    managed.abortController = controller;
    managed.run = { ...managed.run, status: 'active', updatedAt: now() };

    if (request.model) {
      managed.run = {
        ...managed.run,
        providerID: request.model.providerID,
        modelID: request.model.modelID,
      };
    }

    // Emit user message as a token event so the renderer can display it
    // without needing to echo it locally.
    emit(request.runId, {
      type: 'token',
      partID: `user-${Date.now()}`,
      text: '',
    });
  };

  const abort = (request: AbortRunRequest): void => {
    const managed = runs.get(request.runId);
    if (!managed) return;

    managed.abortController?.abort();
    managed.abortController = null;
    updateStatus(request.runId, 'aborted');
    emit(request.runId, { type: 'done' });
  };

  const respondToApproval = (response: ApprovalResponse): void => {
    const managed = runs.get(response.runId);
    if (!managed) return;

    if (response.approved) {
      updateStatus(response.runId, 'active');
    } else {
      updateStatus(response.runId, 'aborted');
      emit(response.runId, { type: 'done' });
    }
  };

  const subscribe = (runId: string, listener: RunEventListener): (() => void) => {
    const managed = runs.get(runId);
    if (!managed) {
      return () => {};
    }

    managed.listeners.add(listener);
    return () => {
      managed.listeners.delete(listener);
    };
  };

  const getEventLog = (runId: string): StoredRunEvent[] => {
    return runs.get(runId)?.eventLog ?? [];
  };

  return { create, get, list, prompt, abort, respondToApproval, subscribe, getEventLog };
};
