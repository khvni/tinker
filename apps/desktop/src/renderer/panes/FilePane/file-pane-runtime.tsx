import { createContext, useContext } from 'react';

export type FilePaneRuntime = {
  vaultRevision: number;
  openFile(path: string, options?: { mime?: string }): void;
};

export const FilePaneRuntimeContext = createContext<FilePaneRuntime | null>(null);

export const useFilePaneRuntime = (): FilePaneRuntime | null => {
  return useContext(FilePaneRuntimeContext);
};
