import { getRenderer, registerPane } from './pane-registry.js';
import { registerFilePane } from '../panes/FilePane/index.js';
import { RegisteredChatPane } from './components/RegisteredChatPane/index.js';
import { registerWorkspacePaneRenderers } from './register-pane-renderers.js';

const isMissingPaneError = (kind: 'chat' | 'file', error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.startsWith(`getRenderer: no renderer registered for pane kind "${kind}".`)
  );
};

const ensurePaneRegistered = (kind: 'chat' | 'file', register: () => void): void => {
  try {
    getRenderer(kind);
    return;
  } catch (error) {
    if (!isMissingPaneError(kind, error)) {
      throw error;
    }
  }

  register();
};

export const registerWorkspacePanes = (): void => {
  ensurePaneRegistered('chat', () => {
    registerPane('chat', (data) => {
      void data;
      return <RegisteredChatPane />;
    });
  });

  ensurePaneRegistered('file', () => {
    registerFilePane();
  });

  registerWorkspacePaneRenderers();
};
