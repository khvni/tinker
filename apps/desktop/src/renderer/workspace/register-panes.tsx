import { getRenderer, registerPane } from './pane-registry.js';
import { RegisteredChatPane } from './components/RegisteredChatPane/index.js';

const isMissingChatPaneError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.startsWith('getRenderer: no renderer registered for pane kind "chat".')
  );
};

export const registerWorkspacePanes = (): void => {
  try {
    getRenderer('chat');
    return;
  } catch (error) {
    if (!isMissingChatPaneError(error)) {
      throw error;
    }
  }

  registerPane('chat', (data) => {
    void data;
    return <RegisteredChatPane />;
  });
};
