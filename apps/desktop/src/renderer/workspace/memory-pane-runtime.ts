import { createContext, useContext } from 'react';

export type MemoryPaneRuntime = {
  currentUserId: string;
};

export const MemoryPaneRuntimeContext = createContext<MemoryPaneRuntime | null>(null);

export const useMemoryPaneRuntime = (): MemoryPaneRuntime => {
  const runtime = useContext(MemoryPaneRuntimeContext);
  if (!runtime) {
    throw new Error(
      'Memory pane runtime is missing. Wrap workspace panes in MemoryPaneRuntimeContext.Provider.',
    );
  }

  return runtime;
};
