import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type FlashReason =
  | 'notification-arrival'
  | 'notification-dismiss'
  | 'manual-unread-dismiss'
  | 'navigation'
  | 'debug';

export type FlashAccent = 'notification-blue' | 'navigation-teal';

export type AttentionSignal = {
  readonly workspaceId: string;
  readonly paneId: string;
  readonly reason: FlashReason;
};

export type AttentionFlash = {
  readonly paneId: string;
  readonly reason: FlashReason;
  readonly accent: FlashAccent;
  readonly startedAt: number;
};

export type AttentionSnapshot = {
  readonly workspaceId: string | null;
  readonly focusedPaneId: string | null;
  readonly unreadPaneIds: ReadonlySet<string>;
  readonly focusedReadPaneId: string | null;
  readonly manualUnreadPaneIds: ReadonlySet<string>;
  readonly activeFlash: AttentionFlash | null;
};

export type WorkspaceAttentionSnapshot = Omit<AttentionSnapshot, 'workspaceId'>;

export type HydrateAttentionWorkspaceInput = {
  readonly workspaceId: string;
  readonly focusedPaneId?: string | null;
  readonly focusedReadPaneId?: string | null;
  readonly unreadPaneIds?: ReadonlyArray<string>;
  readonly manualUnreadPaneIds?: ReadonlyArray<string>;
};

export type FocusPaneInput = {
  readonly workspaceId: string;
  readonly paneId: string | null;
};

export type ManualUnreadInput = {
  readonly workspaceId: string;
  readonly paneId: string;
};

export type AttentionActions = {
  readonly activateWorkspace: (workspaceId: string) => void;
  readonly hydrateWorkspace: (input: HydrateAttentionWorkspaceInput) => void;
  readonly reset: () => void;
  readonly focusPane: (input: FocusPaneInput) => void;
  readonly markPaneManualUnread: (input: ManualUnreadInput) => void;
  readonly signal: (signal: AttentionSignal) => void;
  readonly clearFlash: (workspaceId: string) => void;
};

export type AttentionStoreState = {
  readonly activeWorkspaceId: string | null;
  readonly workspaces: Readonly<Record<string, WorkspaceAttentionSnapshot>>;
  readonly actions: AttentionActions;
};

export type AttentionStore = StoreApi<AttentionStoreState>;

export type CreateAttentionStoreOptions = {
  readonly now?: () => number;
};

export type PaneAttentionState = {
  readonly unread: boolean;
  readonly flash: null | { readonly accent: FlashAccent; readonly progress: number };
};

export type FlashAccentStyle = {
  readonly peakOpacity: number;
  readonly blurRadius: number;
};

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

const EMPTY_WORKSPACE_SNAPSHOT: WorkspaceAttentionSnapshot = {
  focusedPaneId: null,
  unreadPaneIds: EMPTY_SET,
  focusedReadPaneId: null,
  manualUnreadPaneIds: EMPTY_SET,
  activeFlash: null,
};

const EMPTY_ATTENTION_SNAPSHOT: AttentionSnapshot = {
  workspaceId: null,
  ...EMPTY_WORKSPACE_SNAPSHOT,
};

export const FLASH_RAMP_UP_MS = 120;
export const FLASH_HOLD_MS = 180;
export const FLASH_RAMP_DOWN_MS = 420;
export const FLASH_DURATION_MS = FLASH_RAMP_UP_MS + FLASH_HOLD_MS + FLASH_RAMP_DOWN_MS;

export const FLASH_ACCENT_STYLES: Readonly<Record<FlashAccent, FlashAccentStyle>> = {
  'notification-blue': { peakOpacity: 0.6, blurRadius: 6 },
  'navigation-teal': { peakOpacity: 0.14, blurRadius: 3 },
};

const emptyWorkspaceSnapshot = (): WorkspaceAttentionSnapshot => ({
  focusedPaneId: null,
  unreadPaneIds: new Set<string>(),
  focusedReadPaneId: null,
  manualUnreadPaneIds: new Set<string>(),
  activeFlash: null,
});

const withPaneAdded = (source: ReadonlySet<string>, paneId: string): ReadonlySet<string> => {
  if (source.has(paneId)) return source;
  const next = new Set(source);
  next.add(paneId);
  return next;
};

const withPaneRemoved = (source: ReadonlySet<string>, paneId: string): ReadonlySet<string> => {
  if (!source.has(paneId)) return source;
  const next = new Set(source);
  next.delete(paneId);
  return next;
};

const isFocused = (workspace: WorkspaceAttentionSnapshot, paneId: string): boolean => {
  return workspace.focusedPaneId === paneId;
};

const hasCompetingIndicator = (
  workspace: WorkspaceAttentionSnapshot,
  paneId: string,
): boolean => {
  for (const candidate of workspace.unreadPaneIds) {
    if (candidate !== paneId) return true;
  }
  for (const candidate of workspace.manualUnreadPaneIds) {
    if (candidate !== paneId) return true;
  }
  return workspace.activeFlash?.accent === 'notification-blue' && workspace.activeFlash.paneId !== paneId;
};

const toFlashAccent = (reason: FlashReason): FlashAccent => {
  return reason === 'navigation' ? 'navigation-teal' : 'notification-blue';
};

const buildFlash = (signal: AttentionSignal, startedAt: number): AttentionFlash => ({
  paneId: signal.paneId,
  reason: signal.reason,
  accent: toFlashAccent(signal.reason),
  startedAt,
});

const withWorkspaceSnapshot = (
  state: AttentionStoreState,
  workspaceId: string,
  transform: (snapshot: WorkspaceAttentionSnapshot) => WorkspaceAttentionSnapshot,
): AttentionStoreState => {
  const current = state.workspaces[workspaceId] ?? emptyWorkspaceSnapshot();
  const next = transform(current);
  if (next === current && state.activeWorkspaceId === workspaceId) return state;
  return {
    ...state,
    activeWorkspaceId: workspaceId,
    workspaces: {
      ...state.workspaces,
      [workspaceId]: next,
    },
  };
};

const clearFlashForWorkspace = (
  state: AttentionStoreState,
  workspaceId: string,
): AttentionStoreState => {
  return withWorkspaceSnapshot(state, workspaceId, (workspace) => {
    if (workspace.activeFlash === null) return workspace;
    return { ...workspace, activeFlash: null };
  });
};

const reduceSignal = (
  workspace: WorkspaceAttentionSnapshot,
  signal: AttentionSignal,
  startedAt: number,
): WorkspaceAttentionSnapshot => {
  let unreadPaneIds = workspace.unreadPaneIds;
  let manualUnreadPaneIds = workspace.manualUnreadPaneIds;
  let focusedReadPaneId = workspace.focusedReadPaneId;
  let activeFlash = workspace.activeFlash;

  switch (signal.reason) {
    case 'notification-arrival': {
      if (isFocused(workspace, signal.paneId)) {
        unreadPaneIds = withPaneRemoved(unreadPaneIds, signal.paneId);
        focusedReadPaneId = signal.paneId;
        break;
      }
      unreadPaneIds = withPaneAdded(unreadPaneIds, signal.paneId);
      activeFlash = buildFlash(signal, startedAt);
      break;
    }
    case 'navigation': {
      if (isFocused(workspace, signal.paneId) || hasCompetingIndicator(workspace, signal.paneId)) {
        break;
      }
      activeFlash = buildFlash(signal, startedAt);
      break;
    }
    case 'manual-unread-dismiss': {
      unreadPaneIds = withPaneRemoved(unreadPaneIds, signal.paneId);
      manualUnreadPaneIds = withPaneRemoved(manualUnreadPaneIds, signal.paneId);
      activeFlash = buildFlash(signal, startedAt);
      break;
    }
    case 'notification-dismiss': {
      unreadPaneIds = withPaneRemoved(unreadPaneIds, signal.paneId);
      if (isFocused(workspace, signal.paneId)) {
        activeFlash = buildFlash(signal, startedAt);
      }
      break;
    }
    case 'debug': {
      activeFlash = buildFlash(signal, startedAt);
      break;
    }
  }

  if (
    unreadPaneIds === workspace.unreadPaneIds &&
    manualUnreadPaneIds === workspace.manualUnreadPaneIds &&
    focusedReadPaneId === workspace.focusedReadPaneId &&
    activeFlash === workspace.activeFlash
  ) {
    return workspace;
  }

  return {
    ...workspace,
    unreadPaneIds,
    manualUnreadPaneIds,
    focusedReadPaneId,
    activeFlash,
  };
};

const initialAttentionState = (): Omit<AttentionStoreState, 'actions'> => ({
  activeWorkspaceId: null,
  workspaces: {},
});

const scheduleAnimationFrame = (callback: () => void):
  | { readonly kind: 'raf'; readonly id: number }
  | { readonly kind: 'timeout'; readonly id: ReturnType<typeof setTimeout> } => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return { kind: 'raf', id: globalThis.requestAnimationFrame(() => callback()) };
  }
  return { kind: 'timeout', id: setTimeout(callback, 16) };
};

const cancelAnimationFrameHandle = (
  handle:
    | { readonly kind: 'raf'; readonly id: number }
    | { readonly kind: 'timeout'; readonly id: ReturnType<typeof setTimeout> },
): void => {
  if (handle.kind === 'raf') {
    globalThis.cancelAnimationFrame?.(handle.id);
    return;
  }
  clearTimeout(handle.id);
};

export const createAttentionStore = (
  options: CreateAttentionStoreOptions = {},
): AttentionStore => {
  const now = options.now ?? (() => Date.now());
  const flashTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const cancelFlashTimer = (workspaceId: string): void => {
    const timer = flashTimers.get(workspaceId);
    if (timer === undefined) return;
    clearTimeout(timer);
    flashTimers.delete(workspaceId);
  };

  const cancelAllFlashTimers = (): void => {
    for (const timer of flashTimers.values()) {
      clearTimeout(timer);
    }
    flashTimers.clear();
  };

  return createStore<AttentionStoreState>((set, get) => ({
    ...initialAttentionState(),
    actions: {
      activateWorkspace: (workspaceId) => {
        set((state) => withWorkspaceSnapshot(state, workspaceId, (workspace) => workspace));
      },
      hydrateWorkspace: (input) => {
        cancelFlashTimer(input.workspaceId);
        set((state) => ({
          ...state,
          activeWorkspaceId: input.workspaceId,
          workspaces: {
            ...state.workspaces,
            [input.workspaceId]: {
              focusedPaneId: input.focusedPaneId ?? null,
              focusedReadPaneId: input.focusedReadPaneId ?? null,
              unreadPaneIds: new Set(input.unreadPaneIds ?? []),
              manualUnreadPaneIds: new Set(input.manualUnreadPaneIds ?? []),
              activeFlash: null,
            },
          },
        }));
      },
      reset: () => {
        cancelAllFlashTimers();
        set({ ...initialAttentionState(), actions: get().actions });
      },
      focusPane: ({ workspaceId, paneId }) => {
        set((state) =>
          withWorkspaceSnapshot(state, workspaceId, (workspace) => {
            let unreadPaneIds = workspace.unreadPaneIds;
            let focusedReadPaneId = workspace.focusedReadPaneId;

            if (paneId !== null) {
              unreadPaneIds = withPaneRemoved(unreadPaneIds, paneId);
              focusedReadPaneId = paneId;
            }

            if (
              workspace.focusedPaneId === paneId &&
              unreadPaneIds === workspace.unreadPaneIds &&
              focusedReadPaneId === workspace.focusedReadPaneId
            ) {
              return workspace;
            }

            return {
              ...workspace,
              focusedPaneId: paneId,
              unreadPaneIds,
              focusedReadPaneId,
            };
          }),
        );
      },
      markPaneManualUnread: ({ workspaceId, paneId }) => {
        set((state) =>
          withWorkspaceSnapshot(state, workspaceId, (workspace) => {
            const manualUnreadPaneIds = withPaneAdded(workspace.manualUnreadPaneIds, paneId);
            if (manualUnreadPaneIds === workspace.manualUnreadPaneIds) return workspace;
            return {
              ...workspace,
              manualUnreadPaneIds,
            };
          }),
        );
      },
      signal: (signal) => {
        const startedAt = now();
        let nextFlash: AttentionFlash | null | undefined;
        set((state) =>
          withWorkspaceSnapshot(state, signal.workspaceId, (workspace) => {
            const next = reduceSignal(workspace, signal, startedAt);
            if (next.activeFlash !== workspace.activeFlash) {
              nextFlash = next.activeFlash;
            }
            return next;
          }),
        );

        if (nextFlash !== undefined) {
          cancelFlashTimer(signal.workspaceId);
          if (nextFlash !== null) {
            const timer = setTimeout(() => {
              set((state) => clearFlashForWorkspace(state, signal.workspaceId));
              flashTimers.delete(signal.workspaceId);
            }, FLASH_DURATION_MS);
            flashTimers.set(signal.workspaceId, timer);
          }
        }
      },
      clearFlash: (workspaceId) => {
        cancelFlashTimer(workspaceId);
        set((state) => clearFlashForWorkspace(state, workspaceId));
      },
    },
  }));
};

export const selectWorkspaceAttentionSnapshot = (
  state: AttentionStoreState,
  workspaceId: string,
): AttentionSnapshot => {
  const workspace = state.workspaces[workspaceId];
  if (!workspace) {
    return { workspaceId, ...EMPTY_WORKSPACE_SNAPSHOT };
  }
  return { workspaceId, ...workspace };
};

export const selectAttentionSnapshot = (
  state: AttentionStoreState,
): AttentionSnapshot => {
  const workspaceId = state.activeWorkspaceId;
  if (workspaceId === null) return EMPTY_ATTENTION_SNAPSHOT;
  return selectWorkspaceAttentionSnapshot(state, workspaceId);
};

export const collectUnreadPaneIds = (
  snapshot: Pick<AttentionSnapshot, 'unreadPaneIds' | 'manualUnreadPaneIds'>,
): ReadonlySet<string> => {
  if (snapshot.unreadPaneIds.size === 0) return snapshot.manualUnreadPaneIds;
  if (snapshot.manualUnreadPaneIds.size === 0) return snapshot.unreadPaneIds;
  const next = new Set(snapshot.unreadPaneIds);
  for (const paneId of snapshot.manualUnreadPaneIds) {
    next.add(paneId);
  }
  return next;
};

export const countUnreadPanes = (
  snapshot: Pick<AttentionSnapshot, 'unreadPaneIds' | 'manualUnreadPaneIds'>,
): number => collectUnreadPaneIds(snapshot).size;

export const getFlashProgress = (startedAt: number, currentTime: number = Date.now()): number => {
  const elapsed = currentTime - startedAt;
  if (elapsed <= 0) return 0;
  if (elapsed >= FLASH_DURATION_MS) return 1;
  return elapsed / FLASH_DURATION_MS;
};

export const getFlashOpacity = (
  accent: FlashAccent,
  elapsedMs: number,
): number => {
  if (elapsedMs <= 0) return 0;

  const peak = FLASH_ACCENT_STYLES[accent].peakOpacity;
  if (elapsedMs < FLASH_RAMP_UP_MS) {
    return peak * (elapsedMs / FLASH_RAMP_UP_MS);
  }

  if (elapsedMs <= FLASH_RAMP_UP_MS + FLASH_HOLD_MS) {
    return peak;
  }

  if (elapsedMs >= FLASH_DURATION_MS) {
    return 0;
  }

  const fadeElapsed = elapsedMs - FLASH_RAMP_UP_MS - FLASH_HOLD_MS;
  return peak * (1 - fadeElapsed / FLASH_RAMP_DOWN_MS);
};

export const useAttentionSnapshot = (store: AttentionStore): AttentionSnapshot => {
  return useStore(store, selectAttentionSnapshot);
};

export const useAttentionActions = (store: AttentionStore): AttentionActions => {
  return useStore(store, (state) => state.actions);
};

export const useAttentionSignal = (
  store: AttentionStore,
): AttentionActions['signal'] => {
  return useStore(store, (state) => state.actions.signal);
};

export const usePaneAttentionState = (
  store: AttentionStore,
  paneId: string,
): PaneAttentionState => {
  const unread = useStore(store, (state) => {
    const snapshot = selectAttentionSnapshot(state);
    return snapshot.unreadPaneIds.has(paneId) || snapshot.manualUnreadPaneIds.has(paneId);
  });
  const activeFlash = useStore(store, (state) => {
    const snapshot = selectAttentionSnapshot(state);
    return snapshot.activeFlash?.paneId === paneId ? snapshot.activeFlash : null;
  });
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (activeFlash === null) return;

    setCurrentTime(Date.now());
    const tick = (): void => {
      const nextTime = Date.now();
      setCurrentTime(nextTime);
      if (nextTime - activeFlash.startedAt < FLASH_DURATION_MS) {
        handle = scheduleAnimationFrame(tick);
      }
    };

    let handle = scheduleAnimationFrame(tick);
    return () => {
      cancelAnimationFrameHandle(handle);
    };
  }, [activeFlash]);

  const flash = useMemo(() => {
    if (activeFlash === null) return null;
    const progress = getFlashProgress(activeFlash.startedAt, currentTime);
    if (progress >= 1) return null;
    return { accent: activeFlash.accent, progress };
  }, [activeFlash, currentTime]);

  return { unread, flash };
};
