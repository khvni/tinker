import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { injectActiveSkills, injectMemoryContext, streamSessionEvents } from '@tinker/bridge';
import { resolveRelevantEntities, slugify } from '@tinker/memory';
import type { SkillDraft, SkillStore } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../bindings.js';
import { captureConversationMemory } from '../memory.js';
import { createWorkspaceClient, getOpencodeDirectory } from '../opencode.js';
import { useDockviewApi } from '../workspace/DockviewContext.js';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

type ChatProps = {
  skillStore: SkillStore;
  modelConnected: boolean;
  opencode: OpencodeConnection;
  vaultPath: string | null;
  activeSkillsRevision: number;
  onFileWritten?: (path: string) => void;
  onMemoryCommitted?: () => void;
};

const deriveSkillSlug = (text: string): string => {
  const firstLine = text.split('\n').find((line) => line.trim().length > 0) ?? 'new-skill';
  const trimmed = firstLine.replace(/^#+\s*/u, '').slice(0, 80);
  const slug = slugify(trimmed);
  return slug.length > 0 ? slug : 'new-skill';
};

const deriveSkillDescription = (text: string): string => {
  const cleaned = text.replace(/[#*`]/gu, '').trim().replace(/\s+/gu, ' ');
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned;
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

export const Chat = ({
  skillStore,
  modelConnected,
  opencode,
  vaultPath,
  activeSkillsRevision,
  onFileWritten,
  onMemoryCommitted,
}: ChatProps): JSX.Element => {
  const client = useMemo(
    () => createWorkspaceClient(opencode, getOpencodeDirectory(vaultPath)),
    [opencode.baseUrl, opencode.password, opencode.username, vaultPath],
  );
  const dockviewApi = useDockviewApi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(modelConnected ? 'OpenCode is ready.' : 'Connect GPT-5.4 in Settings to start chatting.');
  const mountedRef = useRef(true);
  const sessionIDRef = useRef<string | null>(null);
  const memoryCommitRef = useRef<Promise<void>>(Promise.resolve());

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

  useEffect(() => {
    // When the active skill set changes, abandon the current session so the next
    // prompt spins up a fresh session with the refreshed skill injection.
    const existing = sessionIDRef.current;
    sessionIDRef.current = null;
    if (existing) {
      void client.session.abort({ sessionID: existing });
    }
  }, [activeSkillsRevision, client]);

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

    try {
      const activeSkills = await skillStore.getActive();
      if (activeSkills.length > 0) {
        await injectActiveSkills(client, session.id, activeSkills);
      }
    } catch (error) {
      console.warn('Failed to inject active skills into the session.', error);
    }

    return session.id;
  };

  const openDojoWithDraft = (seedDraft: SkillDraft): void => {
    if (!dockviewApi) {
      return;
    }

    const existing = dockviewApi.panels.find((panel) => panel.id === 'dojo');
    if (existing) {
      existing.api.updateParameters({
        skillStore,
        vaultPath,
        initialDraft: seedDraft,
        focus: 'author',
      });
      existing.api.setActive();
      return;
    }

    const referencePanelId = dockviewApi.activePanel?.id ?? dockviewApi.panels[0]?.id ?? null;
    dockviewApi.addPanel({
      id: 'dojo',
      component: 'dojo',
      title: 'Dojo',
      params: {
        skillStore,
        vaultPath,
        initialDraft: seedDraft,
        focus: 'author',
      },
      ...(referencePanelId
        ? {
            position: {
              referencePanel: referencePanelId,
              direction: 'within' as const,
            },
          }
        : {}),
    });
  };

  const handleSaveAsSkill = (message: ChatMessage): void => {
    const seed: SkillDraft = {
      slug: deriveSkillSlug(message.text),
      description: deriveSkillDescription(message.text),
      body: message.text,
    };
    openDojoWithDraft(seed);
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
      const relevantEntities = await resolveRelevantEntities(text, 6);
      await injectMemoryContext(client, activeSessionID, relevantEntities);

      const stream = streamSessionEvents(client, activeSessionID);
      const toolResults: Array<{ name: string; output: string }> = [];
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
            toolResults.push({ name: event.name, output: event.output });
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

      const assistantMessage = formatMessages(history.data ?? [])
        .filter((message) => message.role === 'assistant')
        .at(-1)?.text;
      if (assistantMessage && vaultPath) {
        memoryCommitRef.current = memoryCommitRef.current.then(async () => {
          try {
            const result = await captureConversationMemory(opencode, vaultPath, {
              observedOn: new Date().toISOString().slice(0, 10),
              userMessage: text,
              assistantMessage,
              toolResults,
            });

            if (result && result.appendedFacts > 0) {
              onMemoryCommitted?.();
            }
          } catch (error) {
            console.warn('Failed to append conversation memory.', error);
          }
        });
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
            <p className="tinker-message-text">{message.text}</p>
            {message.role === 'assistant' && message.text.trim().length > 0 ? (
              <div className="tinker-message-actions">
                <button
                  type="button"
                  className="tinker-button-ghost tinker-button-ghost--small"
                  onClick={() => handleSaveAsSkill(message)}
                >
                  Save as skill
                </button>
              </div>
            ) : null}
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
