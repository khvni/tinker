import { useSyncExternalStore } from 'react';
import type { WorkspaceStore, WorkspaceStoreState } from '../../core/store/store.js';

export const useWorkspaceSelector = <TData, TSlice>(
  store: WorkspaceStore<TData>,
  selector: (state: WorkspaceStoreState<TData>) => TSlice,
): TSlice => {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getInitialState()),
  );
};

export const useWorkspaceActions = <TData>(store: WorkspaceStore<TData>) => {
  return useWorkspaceSelector(store, (state) => state.actions);
};
