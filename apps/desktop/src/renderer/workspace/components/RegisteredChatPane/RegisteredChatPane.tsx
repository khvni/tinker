import { useEffect, useRef, type JSX } from 'react';
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
};

export const RegisteredChatPane = ({
  isActive,
  tabId,
  paneId,
  paneData,
  onAttentionSignal,
  onSelectSessionFolder: propOnSelectSessionFolder,
}: RegisteredChatPaneProps): JSX.Element => {
  const runtime = useChatPaneRuntime();
  const { persistPaneSessionId, getConnectionForPane, releaseConnectionForPane, onSelectSessionFolder: runtimeOnSelectSessionFolder, ...chatRuntime } = runtime;

  const paneDataWithDefaults = paneData ?? ({ kind: 'chat' } as Extract<TinkerPaneData, { readonly kind: 'chat' }>);
  const opencode = getConnectionForPane ? getConnectionForPane(paneDataWithDefaults) : chatRuntime.opencode;

  const releaseRef = useRef(releaseConnectionForPane);
  releaseRef.current = releaseConnectionForPane;
  const paneDataRef = useRef(paneDataWithDefaults);
  paneDataRef.current = paneDataWithDefaults;

  useEffect(() => {
    return () => {
      if (releaseRef.current) {
        void releaseRef.current(paneDataRef.current);
      }
    };
  }, []);

  return (
    <Chat
      {...chatRuntime}
      opencode={opencode}
      {...(isActive !== undefined ? { paneIsActive: isActive } : {})}
      {...(onAttentionSignal ? { onAttentionSignal } : {})}
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
