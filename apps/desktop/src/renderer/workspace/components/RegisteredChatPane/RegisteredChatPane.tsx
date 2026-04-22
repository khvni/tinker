import type { JSX } from 'react';
import type { FlashReason } from '@tinker/attention';
import type { TinkerPaneData } from '@tinker/shared-types';
import { Chat } from '../../../panes/Chat/index.js';
import { useChatPaneRuntime } from '../../chat-pane-runtime.js';

type RegisteredChatPaneProps = {
  isActive?: boolean;
  tabId?: string;
  paneId?: string;
  paneData?: Extract<TinkerPaneData, { readonly kind: 'chat' }>;
  onAttentionSignal?: (reason: FlashReason) => void;
};

export const RegisteredChatPane = ({
  isActive,
  tabId,
  paneId,
  paneData,
  onAttentionSignal,
}: RegisteredChatPaneProps): JSX.Element => {
  const runtime = useChatPaneRuntime();
  const { persistPaneSessionId, ...chatRuntime } = runtime;

  return (
    <Chat
      {...chatRuntime}
      {...(isActive !== undefined ? { paneIsActive: isActive } : {})}
      {...(onAttentionSignal ? { onAttentionSignal } : {})}
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
