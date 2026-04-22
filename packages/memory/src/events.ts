export const MEMORY_PATH_CHANGED_EVENT = 'memory.path-changed';

export type MemoryPathChangeReason = 'root-changed' | 'user-changed';

export type MemoryPathChangedDetail = {
  reason: MemoryPathChangeReason;
  previousRoot?: string;
  nextRoot?: string;
  previousPath?: string | null;
  nextPath?: string | null;
  previousUserId?: string | null;
  nextUserId?: string | null;
};

type MemoryPathChangedListener = (detail: MemoryPathChangedDetail) => void;

const memoryPathListeners = new Set<MemoryPathChangedListener>();

export const emitMemoryPathChanged = (detail: MemoryPathChangedDetail): void => {
  for (const listener of [...memoryPathListeners]) {
    try {
      listener(detail);
    } catch (error) {
      console.warn(`Unhandled "${MEMORY_PATH_CHANGED_EVENT}" listener failure.`, error);
    }
  }
};

export const subscribeMemoryPathChanged = (
  listener: MemoryPathChangedListener,
): (() => void) => {
  memoryPathListeners.add(listener);
  return () => {
    memoryPathListeners.delete(listener);
  };
};

export const resetMemoryPathChangedListeners = (): void => {
  memoryPathListeners.clear();
};
