import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { injectMemoryContext, streamSessionEvents } from '@tinker/bridge';
import type { MemoryStore } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../bindings.js';
import { createWorkspaceClient, getOpencodeDirectory } from '../opencode.js';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

type ChatProps = {
  memoryStore: MemoryStore;
  modelConnected: boolean;
  opencode: OpencodeConnection;
  vaultPath: string | null;
  onFileWritten?: (path: string) => void;
};

const formatMessages = (messages: Array<{ info: Message; parts: Part[] }>): ChatMessage[] => {
  return messages.map(({ info, parts }) => {
    const text = parts
      .filter((part): part is Extract<Part, { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('');

    return {
      id: info.id,
      role: info.role,
      text: text.length > 0 ? text : info.role === 'assistant' ? 'Response contained only non-text output.' : 'Message sent.',
    };
  });
};

export const Chat = ({ memoryStore, modelConnected, opencode, vaultPath, onFileWritten }: ChatProps): JSX.Element => {
  const client = useMemo(
    () => createWorkspaceClient(opencode, getOpencodeDirectory(vaultPath)),
    [opencode.baseUrl, opencode.password, opencode.username, vaultPath],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(modelConnected ? 'OpenCode is ready.' : 'Connect GPT-5.4 in Settings to start chatting.');
  const mountedRef = useRef(true);
  const sessionIDRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const activeSessionID = sessionIDRef.current;
      sessionIDRef.current = null;
      if (activeSessionID) {
        void client.session.abort({ sessionID: activeSessionID });
      }
    };
  }, [client]);

  useEffect(() => {
    setStatus(modelConnected ? 'OpenCode is ready.' : 'Connect GPT-5.4 in Settings to start chatting.');
  }, [modelConnected]);

  const ensureSession = async (): Promise<string> => {
    if (sessionIDRef.current) {
      return sessionIDRef.current;
    }

    const response = await client.session.create({ title: 'Tinker Chat' });
    const session = response.data;
    if (!session) {
      throw new Error('OpenCode did not return a session.');
    }

    sessionIDRef.current = session.id;
    return session.id;
  };

  const sendMessage = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy || !modelConnected) {
      return;
    }

    setBusy(true);
    setStatus('Waiting for OpenCode…');
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text }]);
    setInput('');
    setDraft('');

    try {
      const activeSessionID = await ensureSession();
      const relevantEntities = await memoryStore.recentEntities(5);
      await injectMemoryContext(client, activeSessionID, relevantEntities);

      const stream = streamSessionEvents(client, activeSessionID);
      const consumeStream = (async () => {
        for await (const event of stream) {
          if (!mountedRef.current) {
            return;
          }

          if (event.type === 'token') {
            setDraft((current) => current + event.text);
          } else if (event.type === 'tool_call') {
            setStatus(`Running ${event.name}…`);
          } else if (event.type === 'tool_result') {
            setStatus(`${event.name} finished.`);
          } else if (event.type === 'file_written') {
            onFileWritten?.(event.path);
          } else if (event.type === 'error') {
            setStatus(event.message);
          } else if (event.type === 'done') {
            setStatus('OpenCode is ready.');
          }
        }
      })();

      await client.session.prompt({
        sessionID: activeSessionID,
        parts: [{ type: 'text', text }],
      });
      await consumeStream;

      const history = await client.session.messages({ sessionID: activeSessionID, limit: 24 });
      if (mountedRef.current) {
        setMessages(formatMessages(history.data ?? []));
        setDraft('');
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'system',
          text: error instanceof Error ? error.message : String(error),
        },
      ]);
      setStatus('Chat hit an error.');
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  return (
    <section className="tinker-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Chat</p>
          <h2>Talk to OpenCode directly</h2>
        </div>
        <span className="tinker-pill">{status}</span>
      </header>

      <div className="tinker-chat-log">
        {messages.length === 0 ? (
          <div className="tinker-message tinker-message--system">
            {modelConnected
              ? 'Ask Tinker a question. Messages stream from OpenCode over HTTP + SSE.'
              : 'Connect GPT-5.4 in Settings before sending a message.'}
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`tinker-message tinker-message--${message.role}`}>
            {message.text}
          </div>
        ))}

        {draft ? <div className="tinker-message tinker-message--assistant">{draft}</div> : null}
      </div>

      <div className="tinker-composer">
        <textarea
          value={input}
          placeholder="Ask about the vault, your project, or the next change to make."
          onChange={(event) => setInput(event.currentTarget.value)}
          disabled={busy || !modelConnected}
        />
        <div className="tinker-inline-actions">
          <button
            className="tinker-button"
            type="button"
            onClick={sendMessage}
            disabled={busy || !modelConnected || input.trim().length === 0}
          >
            {busy ? 'Streaming…' : 'Send message'}
          </button>
        </div>
      </div>
    </section>
  );
};
