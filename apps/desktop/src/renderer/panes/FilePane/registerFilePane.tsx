import type { ReactNode } from 'react';
import { registerPane } from '../../workspace/pane-registry.js';
import { FilePane } from './FilePane.js';

export type RegisterFilePaneOptions = {
  vaultRevision?: number;
};

export const registerFilePane = ({ vaultRevision = 0 }: RegisterFilePaneOptions = {}): void => {
  registerPane('file', (data): ReactNode => <FilePane data={data} vaultRevision={vaultRevision} />);
};
