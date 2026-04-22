import { createContext, useContext, type ComponentProps } from 'react';
import type { Chat } from '../panes/Chat.js';

export type ChatPaneRuntime = ComponentProps<typeof Chat>;

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
