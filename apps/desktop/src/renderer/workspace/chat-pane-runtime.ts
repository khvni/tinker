import { createContext, useContext, type ComponentProps } from 'react';
import type { Session, TinkerPaneData } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../bindings.js';
import type { Chat } from '../panes/Chat/index.js';

export type ChatPaneRuntime = Omit<
  ComponentProps<typeof Chat>,
  | 'paneSessionId'
  | 'createFreshSession'
  | 'onPersistSessionId'
  | 'opencode'
  | 'onReleaseOpencode'
  | 'onSelectSessionFolder'
> & {
  persistPaneSessionId?: (
    tabId: string,
    paneId: string,
    sessionId: Session['id'],
  ) => void;
  opencode: OpencodeConnection;
  getConnectionForPane?: (paneData: Extract<TinkerPaneData, { readonly kind: 'chat' }>) => OpencodeConnection;
  releaseConnectionForPane?: (paneData: Extract<TinkerPaneData, { readonly kind: 'chat' }>) => void;
  onSelectSessionFolder: () => void | Promise<void>;
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
