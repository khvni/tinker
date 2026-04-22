import type { JSX } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { Chat } from '../../../panes/Chat/index.js';
import { useChatPaneRuntime } from '../../chat-pane-runtime.js';

type RegisteredChatPaneProps = {
  tabId?: string;
  paneId?: string;
  paneData?: Extract<TinkerPaneData, { readonly kind: 'chat' }>;
};

export const RegisteredChatPane = ({
  tabId,
  paneId,
  paneData,
}: RegisteredChatPaneProps): JSX.Element => {
  const runtime = useChatPaneRuntime();
  const { persistPaneSessionId, ...chatRuntime } = runtime;

  return (
    <Chat
      {...chatRuntime}
      {...(paneData?.sessionId ? { paneSessionId: paneData.sessionId } : {})}
      {...(persistPaneSessionId && tabId && paneId
        ? {
            onPersistSessionId: (sessionId: string) =>
              persistPaneSessionId(tabId, paneId, sessionId),
          }
        : {})}
    />
  );
};
