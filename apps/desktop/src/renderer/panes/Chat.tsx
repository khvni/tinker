import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { Badge, Button, ModelPicker, Textarea } from '@tinker/design';
import { injectActiveSkills, injectMemoryContext, streamSessionEvents } from '@tinker/bridge';
import { resolveRelevantEntities, slugify } from '@tinker/memory';
import type { SkillDraft, SkillStore } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../bindings.js';
import { captureConversationMemory } from '../memory.js';
import {
  buildModelPickerItems,
  createWorkspaceClient,
  findModelOptionById,
  getOpencodeDirectory,
  pickDefaultModelOptionId,
  type WorkspaceModelOption,
} from '../opencode.js';
import { useDockviewApi } from '../workspace/DockviewContext.js';
import { useSessionHistoryWindow } from './useSessionHistoryWindow.js';

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
  onOpenNewChat?: () => void;
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

const mergeHistoryMessages = (olderMessages: readonly ChatMessage[], newerMessages: readonly ChatMessage[]): ChatMessage[] => {
  const merged = new Map<string, ChatMessage>();

  for (const message of olderMessages) {
    merged.set(message.id, message);
  }

  for (const message of newerMessages) {
    merged.set(message.id, message);
  }

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
};

export const Chat = ({
  skillStore,
  modelConnected,
  opencode,
  vaultPath,
  activeSkillsRevision,
  onFileWritten,
  onOpenNewChat,
  onMemoryCommitted,
}: ChatProps): JSX.Element => {
  const client = useMemo(
    () => createWorkspaceClient(opencode, getOpencodeDirectory(vaultPath)),
    [opencode.baseUrl, opencode.password, opencode.username, vaultPath],
  );
  const dockviewApi = useDockviewApi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelOptions, setModelOptions] = useState<ReadonlyArray<WorkspaceModelOption>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [modelOptionsLoading, setModelOptionsLoading] = useState(true);
  const [status, setStatus] = useState(modelConnected ? 'OpenCode is ready.' : 'Connect an AI model in Settings to start chatting.');
  const mountedRef = useRef(true);
  const sessionIDRef = useRef<string | null>(null);
  const memoryCommitRef = useRef<Promise<void>>(Promise.resolve());
  const selectedModel = useMemo(() => findModelOptionById(modelOptions, selectedModelId), [modelOptions, selectedModelId]);

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
    setStatus(modelConnected ? 'OpenCode is ready.' : 'Connect an AI model in Settings to start chatting.');
  }, [modelConnected]);

  useEffect(() => {
    let cancelled = false;

    setModelOptionsLoading(true);

    void client.config
      .providers()
      .then((response) => {
        if (cancelled) {
          return;
        }

        const providers = response.data?.providers ?? [];
        const nextOptions = buildModelPickerItems(providers);
        const nextSelectedId = pickDefaultModelOptionId(providers, response.data?.default ?? {}) ?? nextOptions[0]?.id;

        setModelOptions(nextOptions);
        setSelectedModelId((current) => {
          if (current && nextOptions.some((option) => option.id === current)) {
            return current;
          }

          return nextSelectedId;
        });
      })
      .catch((error) => {
        console.warn('Failed to load model picker options from OpenCode.', error);
        if (cancelled) {
          return;
        }

        setModelOptions([]);
        setSelectedModelId(undefined);
      })
      .finally(() => {
        if (!cancelled) {
          setModelOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, modelConnected]);

  useEffect(() => {
    const existing = sessionIDRef.current;
    sessionIDRef.current = null;
    if (existing) {
      void client.session.abort({ sessionID: existing });
    }
    setMessages([]);
    setDraft('');
    setHistoryCursor(null);
    setHistoryLoading(false);
  }, [activeSkillsRevision, client]);

  const loadHistoryPage = async (sessionID: string, before?: string): Promise<{ messages: ChatMessage[]; cursor: string | null }> => {
    const history = await client.session.messages({
      sessionID,
      limit: 100,
      ...(before ? { before } : {}),
    });

    return {
      messages: formatMessages(history.data ?? []),
      cursor: history.response.headers.get('x-next-cursor') ?? null,
    };
  };

  const refreshHistory = async (sessionID: string): Promise<{ messages: ChatMessage[]; cursor: string | null } | null> => {
    const page = await loadHistoryPage(sessionID);
    if (!mountedRef.current || sessionIDRef.current !== sessionID) {
      return null;
    }

    setMessages(page.messages);
    setHistoryCursor(page.cursor);
    return page;
  };

  const loadOlderHistory = async (before: string): Promise<void> => {
    const activeSessionID = sessionIDRef.current;
    if (!activeSessionID || historyLoading) {
      return;
    }

    setHistoryLoading(true);

    try {
      const page = await loadHistoryPage(activeSessionID, before);
      if (!mountedRef.current || sessionIDRef.current !== activeSessionID) {
        return;
      }

      setMessages((current) => mergeHistoryMessages(page.messages, current));
      setHistoryCursor(page.cursor);
    } finally {
      if (mountedRef.current && sessionIDRef.current === activeSessionID) {
        setHistoryLoading(false);
      }
    }
  };

  const historyWindow = useSessionHistoryWindow({
    sessionId: sessionIDRef.current,
    messages,
    cursor: historyCursor,
    isLoading: historyLoading,
    loadMore: loadOlderHistory,
  });

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

  const openPlaybookWithDraft = (seedDraft: SkillDraft): void => {
    if (!dockviewApi) {
      return;
    }

    const existing = dockviewApi.panels.find((panel) => panel.id === 'playbook');
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
      id: 'playbook',
      component: 'playbook',
      title: 'Playbook',
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
    openPlaybookWithDraft(seed);
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
        ...(selectedModel
          ? {
              model: {
                providerID: selectedModel.providerId,
                modelID: selectedModel.modelId,
              },
            }
          : {}),
      });
      await consumeStream;

      const historyPage = await refreshHistory(activeSessionID);
      if (mountedRef.current) {
        setDraft('');
      }

      const assistantMessage = historyPage?.messages
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
        <div className="tinker-inline-actions">
          {onOpenNewChat ? (
            <Button variant="secondary" size="s" onClick={onOpenNewChat}>
              New chat tab
            </Button>
          ) : null}
          <Badge variant="default" size="small">
            {status}
          </Badge>
        </div>
      </header>

      <div className="tinker-chat-log" ref={historyWindow.setScroller} onScroll={historyWindow.handleScroll}>
        {messages.length === 0 ? (
          <div className="tinker-message tinker-message--system">
            {modelConnected
              ? 'Ask Tinker a question. Messages stream from OpenCode over HTTP + SSE.'
              : 'Connect an AI model in Settings before sending a message.'}
          </div>
        ) : null}

        {historyWindow.renderedMessages.map((message) => (
          <div key={message.id} className={`tinker-message tinker-message--${message.role}`}>
            <p className="tinker-message-text">{message.text}</p>
            {message.role === 'assistant' && message.text.trim().length > 0 ? (
              <div className="tinker-message-actions">
                <Button variant="ghost" size="s" onClick={() => handleSaveAsSkill(message)}>
                  Save as skill
                </Button>
              </div>
            ) : null}
          </div>
        ))}

        {draft ? <div className="tinker-message tinker-message--assistant">{draft}</div> : null}
      </div>

      <div className="tinker-composer">
        <Textarea
          value={input}
          rows={4}
          placeholder="Ask about the vault, your project, or the next change to make."
          onChange={(event) => setInput(event.currentTarget.value)}
          disabled={busy || !modelConnected}
        />
        <div className="tinker-inline-actions">
          <ModelPicker
            items={modelOptions}
            value={selectedModelId}
            onSelect={setSelectedModelId}
            loading={modelOptionsLoading}
            disabled={busy}
            emptyLabel="No models available in OpenCode."
          />
          <Button
            variant="primary"
            onClick={sendMessage}
            disabled={busy || !modelConnected || input.trim().length === 0}
          >
            {busy ? 'Streaming…' : 'Send message'}
          </Button>
        </div>
      </div>
    </section>
  );
};
