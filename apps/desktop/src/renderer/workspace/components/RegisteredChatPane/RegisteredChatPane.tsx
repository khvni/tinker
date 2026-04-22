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
  onSelectSessionFolder?: () => Promise<void> | void;
  onDuplicatePane?: () => void;
  onClosePane?: () => void;
};

export const RegisteredChatPane = ({
  isActive,
  tabId,
  paneId,
  paneData,
  onAttentionSignal,
  onSelectSessionFolder: propOnSelectSessionFolder,
  onDuplicatePane,
  onClosePane,
}: RegisteredChatPaneProps): JSX.Element => {
  const runtime = useChatPaneRuntime();
  const {
    persistPaneSessionId,
    getConnectionForPane,
    releaseConnectionForPane,
    onSelectSessionFolder: runtimeOnSelectSessionFolder,
    ...chatRuntime
  } = runtime;

  const paneDataWithDefaults = paneData ?? ({ kind: 'chat' } as Extract<TinkerPaneData, { readonly kind: 'chat' }>);
  const opencode = getConnectionForPane ? getConnectionForPane(paneDataWithDefaults) : chatRuntime.opencode;

  return (
    <Chat
      {...chatRuntime}
      opencode={opencode}
      {...(isActive !== undefined ? { paneIsActive: isActive } : {})}
      {...(onAttentionSignal ? { onAttentionSignal } : {})}
      {...(onDuplicatePane ? { onDuplicatePane } : {})}
      {...(onClosePane ? { onClosePane } : {})}
      {...(paneData?.sessionId ? { paneSessionId: paneData.sessionId } : {})}
      onSelectSessionFolder={propOnSelectSessionFolder ?? runtimeOnSelectSessionFolder}
      onReleaseOpencode={() => {
        if (releaseConnectionForPane) {
          void releaseConnectionForPane(paneDataWithDefaults);
        }
      }}
      {...(persistPaneSessionId && tabId && paneId
        ? {
            onPersistSessionId: (sessionId: string) =>
              persistPaneSessionId(tabId, paneId, sessionId),
          }
        : {})}
    />
  );
};
