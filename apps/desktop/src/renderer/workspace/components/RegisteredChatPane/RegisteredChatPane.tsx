import type { JSX } from 'react';
import { Chat } from '../../../panes/Chat.js';
import { useChatPaneRuntime } from '../../chat-pane-runtime.js';

export const RegisteredChatPane = (): JSX.Element => {
  const runtime = useChatPaneRuntime();
  return <Chat {...runtime} />;
};
