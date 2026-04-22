import { createContext, useContext, type ComponentProps } from 'react';
import type { Session } from '@tinker/shared-types';
import type { Chat } from '../panes/Chat/index.js';

export type ChatPaneRuntime = Omit<
  ComponentProps<typeof Chat>,
  'paneSessionId' | 'onPersistSessionId'
> & {
  persistPaneSessionId?: (
    tabId: string,
    paneId: string,
    sessionId: Session['id'],
  ) => void;
};

export const ChatPaneRuntimeContext = createContext<ChatPaneRuntime | null>(null);

export const useChatPaneRuntime = (): ChatPaneRuntime => {
  const runtime = useContext(ChatPaneRuntimeContext);
  if (!runtime) {
    throw new Error(
      'Chat pane runtime is missing. Wrap workspace panes in ChatPaneRuntimeContext.Provider.',
    );
  }

  return runtime;
};
