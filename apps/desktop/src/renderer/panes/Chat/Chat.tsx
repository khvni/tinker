import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type UIEventHandler,
} from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { Badge, Button, ClickableBadge, ContextBadge, EmptyState, ModelPicker, Textarea } from '@tinker/design';
import { injectActiveSkills, injectMemoryContext, streamSessionEvents } from '@tinker/bridge';
import { resolveRelevantEntities } from '@tinker/memory';
import type { SkillStore } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../../bindings.js';
import { captureConversationMemory } from '../../memory.js';
import {
  buildModelPickerItems,
  createWorkspaceClient,
  findModelOptionById,
  getOpencodeDirectory,
  pickDefaultModelOptionId,
  type WorkspaceModelOption,
} from '../../opencode.js';
import { ChatMessage } from '../ChatMessage/index.js';
import {
  calculateComposerHeight,
  shouldAbortComposerKey,
  shouldSubmitComposerKey,
} from '../chat-composer.js';
import { useSessionHistoryWindow } from '../useSessionHistoryWindow.js';
import { messageTextFromBlocks, MessageBlock, partToBlock, type Block } from './Block.js';
import {
  CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD,
  getChatTailSignature,
  isScrolledNearBottom,
  resolveContextUsage,
  sameResolvedContextUsage,
  type ContextUsageSnapshot,
  type ResolvedContextUsage,
} from './chatState.js';
import { draftReducer } from './draftReducer.js';

type ChatMessageRecord = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blocks: Block[];
};

type ChatProps = {
  skillStore: SkillStore;
  modelConnected: boolean;
  opencode: OpencodeConnection;
  vaultPath: string | null;
  activeSkillsRevision: number;
  onFileWritten?: (path: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenNewChat?: () => void;
  onMemoryCommitted?: () => void;
};

const formatMessages = (messages: Array<{ info: Message; parts: Part[] }>): ChatMessageRecord[] => {
  return messages.map(({ info, parts }) => {
    const blocks: Block[] = [];
    for (const part of parts) {
      const block = partToBlock(part);
      if (block) {
        blocks.push(block);
      }
    }

    const hasText = blocks.some((block) => block.kind === 'text' && block.text.length > 0);
    if (!hasText && (info.role !== 'assistant' || blocks.length === 0)) {
      const placeholder = info.role === 'assistant' ? 'Response contained only non-text output.' : 'Message sent.';
      blocks.push({ kind: 'text', partID: `placeholder-${info.id}`, text: placeholder });
    }

    return {
      id: info.id,
      role: info.role,
      blocks,
    };
  });
};

const mergeHistoryMessages = (olderMessages: readonly ChatMessageRecord[], newerMessages: readonly ChatMessageRecord[]): ChatMessageRecord[] => {
  const merged = new Map<string, ChatMessageRecord>();

  for (const message of olderMessages) {
    merged.set(message.id, message);
  }

  for (const message of newerMessages) {
    merged.set(message.id, message);
  }

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
};

const readPixelValue = (value: string, fallback = 0): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const syncComposerHeight = (textarea: HTMLTextAreaElement | null): void => {
  if (!textarea || typeof window === 'undefined') {
    return;
  }

  const styles = window.getComputedStyle(textarea);
  const fontSize = readPixelValue(styles.fontSize, 16);
  const lineHeight =
    styles.lineHeight === 'normal' ? fontSize * 1.5 : readPixelValue(styles.lineHeight, fontSize * 1.5);

  textarea.style.height = 'auto';

  const { height, maxHeight, overflowY } = calculateComposerHeight({
    scrollHeight: textarea.scrollHeight,
    lineHeight,
    paddingTop: readPixelValue(styles.paddingTop),
    paddingBottom: readPixelValue(styles.paddingBottom),
    borderTopWidth: readPixelValue(styles.borderTopWidth),
    borderBottomWidth: readPixelValue(styles.borderBottomWidth),
  });

  textarea.style.maxHeight = `${maxHeight}px`;
  textarea.style.height = `${height}px`;
  textarea.style.overflowY = overflowY;
};

const readContextUsageTokens = (value: unknown): ContextUsageSnapshot['tokens'] | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const usage = value as {
    total?: unknown;
    input?: unknown;
    output?: unknown;
    reasoning?: unknown;
  };

  if (
    typeof usage.input !== 'number'
    || typeof usage.output !== 'number'
    || typeof usage.reasoning !== 'number'
  ) {
    return null;
  }

  return {
    ...(typeof usage.total === 'number' ? { total: usage.total } : {}),
    input: usage.input,
    output: usage.output,
    reasoning: usage.reasoning,
  };
};

const extractAssistantContextUsage = (
  messages: readonly { info: Message; parts: Part[] }[],
): ContextUsageSnapshot | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const info = messages[index]?.info as {
      role?: unknown;
      providerID?: unknown;
      modelID?: unknown;
      tokens?: unknown;
    };

    if (info.role !== 'assistant') {
      continue;
    }

    const tokens = readContextUsageTokens(info.tokens);
    if (!tokens) {
      continue;
    }

    return {
      providerID: typeof info.providerID === 'string' ? info.providerID : null,
      modelID: typeof info.modelID === 'string' ? info.modelID : null,
      tokens,
    };
  }

  return null;
};

export const Chat = ({
  skillStore,
  modelConnected,
  opencode,
  vaultPath,
  activeSkillsRevision,
  onFileWritten,
  onOpenFileLink,
  onOpenNewChat,
  onMemoryCommitted,
}: ChatProps): JSX.Element => {
  const client = useMemo(
    () => createWorkspaceClient(opencode, getOpencodeDirectory(vaultPath)),
    [opencode.baseUrl, opencode.password, opencode.username, vaultPath],
  );
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draftBlocks, dispatchDraft] = useReducer(draftReducer, []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelOptions, setModelOptions] = useState<ReadonlyArray<WorkspaceModelOption>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [modelOptionsLoading, setModelOptionsLoading] = useState(true);
  const [status, setStatus] = useState(modelConnected ? 'OpenCode is ready.' : 'Connect an AI model in Settings to start chatting.');
  const [contextUsage, setContextUsage] = useState<ResolvedContextUsage | null>(null);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  // Global default applied where no per-disclosure override exists. ⌥T flips this and clears overrides.
  const [defaultDisclosureOpen, setDefaultDisclosureOpen] = useState(false);
  const [disclosureOverrides, setDisclosureOverrides] = useState<Record<string, boolean>>({});
  const mountedRef = useRef(true);
  const sessionIDRef = useRef<string | null>(null);
  const memoryCommitRef = useRef<Promise<void>>(Promise.resolve());
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRequestedRef = useRef(false);
  const contextUsageSnapshotRef = useRef<ContextUsageSnapshot | null>(null);
  const draftBlocksRef = useRef<Block[]>([]);
  const shouldStickToBottomRef = useRef(true);
  const lastTailSignatureRef = useRef('empty');
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
    abortRequestedRef.current = false;
    shouldStickToBottomRef.current = true;
    lastTailSignatureRef.current = 'empty';
    if (existing) {
      void client.session.abort({ sessionID: existing });
    }
    setMessages([]);
    dispatchDraft({ type: 'reset' });
    setHistoryCursor(null);
    setHistoryLoading(false);
    contextUsageSnapshotRef.current = null;
    setContextUsage(null);
    setShowNewMessagesPill(false);
    setDisclosureOverrides({});
    setDefaultDisclosureOpen(false);
  }, [activeSkillsRevision, client]);

  useEffect(() => {
    draftBlocksRef.current = draftBlocks;
  }, [draftBlocks]);

  useLayoutEffect(() => {
    syncComposerHeight(composerRef.current);
  }, [input]);

  // ⌥T toggles the global disclosure default. Listener is scoped to the chat
  // log container so it never fires while typing in inputs / textareas, never
  // intercepts macOS Option+T (`†`) for other panes, and only one Chat pane
  // (the focused one) reacts.
  useEffect(() => {
    const node = chatLogRef.current;
    if (!node) {
      return;
    }
    const handler = (event: globalThis.KeyboardEvent): void => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      if (event.key !== 't' && event.key !== 'T' && event.key !== '†') {
        return;
      }
      event.preventDefault();
      setDefaultDisclosureOpen((current) => !current);
      setDisclosureOverrides({});
    };
    node.addEventListener('keydown', handler);
    return () => {
      node.removeEventListener('keydown', handler);
    };
  }, []);

  // Per-disclosure override wins over the global default; ⌥T clears overrides
  // so the new global default takes over uniformly.
  const isDisclosureOpen = (partID: string): boolean => {
    const override = disclosureOverrides[partID];
    return override === undefined ? defaultDisclosureOpen : override;
  };

  const handleDisclosureToggle = useCallback((partID: string, next: boolean): void => {
    setDisclosureOverrides((current) => ({ ...current, [partID]: next }));
  }, []);

  const loadHistoryPage = async (
    sessionID: string,
    before?: string,
  ): Promise<{ messages: ChatMessageRecord[]; cursor: string | null; contextUsage: ContextUsageSnapshot | null }> => {
    const history = await client.session.messages({
      sessionID,
      limit: 100,
      ...(before ? { before } : {}),
    });

    return {
      messages: formatMessages(history.data ?? []),
      cursor: history.response.headers.get('x-next-cursor') ?? null,
      contextUsage: extractAssistantContextUsage(history.data ?? []),
    };
  };

  const applyContextUsageSnapshot = useCallback((usage: ContextUsageSnapshot): void => {
    contextUsageSnapshotRef.current = usage;
    const next = resolveContextUsage({
      usage,
      modelOptions,
      fallbackModel: selectedModel,
    });

    setContextUsage((current) => (sameResolvedContextUsage(current, next) ? current : next));
  }, [modelOptions, selectedModel]);

  useEffect(() => {
    const snapshot = contextUsageSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    const next = resolveContextUsage({
      usage: snapshot,
      modelOptions,
      fallbackModel: selectedModel,
    });

    setContextUsage((current) => (sameResolvedContextUsage(current, next) ? current : next));
  }, [modelOptions, selectedModel]);

  const refreshHistory = useCallback(
    async (
      sessionID: string,
    ): Promise<{ messages: ChatMessageRecord[]; cursor: string | null; contextUsage: ContextUsageSnapshot | null } | null> => {
      const page = await loadHistoryPage(sessionID);
      if (!mountedRef.current || sessionIDRef.current !== sessionID) {
        return null;
      }

      setMessages(page.messages);
      setHistoryCursor(page.cursor);
      if (page.contextUsage) {
        applyContextUsageSnapshot(page.contextUsage);
      }
      return page;
    },
    [applyContextUsageSnapshot],
  );

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

  const renderedMessageBlocks = useMemo(
    () => historyWindow.renderedMessages.flatMap((message) => message.blocks),
    [historyWindow.renderedMessages],
  );
  const chatTailSignature = useMemo(
    () => getChatTailSignature(renderedMessageBlocks, draftBlocks),
    [draftBlocks, renderedMessageBlocks],
  );

  const setLogScroller = useCallback((node: HTMLDivElement | null): void => {
    chatLogRef.current = node;
    historyWindow.setScroller(node);
  }, [historyWindow]);

  useLayoutEffect(() => {
    const scroller = chatLogRef.current;
    if (!scroller) {
      return;
    }

    const tailChanged = lastTailSignatureRef.current !== chatTailSignature;
    lastTailSignatureRef.current = chatTailSignature;
    if (!tailChanged) {
      return;
    }

    if (shouldStickToBottomRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
      setShowNewMessagesPill(false);
      return;
    }

    setShowNewMessagesPill((current) => (current ? current : true));
  }, [chatTailSignature]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto'): void => {
    const scroller = chatLogRef.current;
    if (!scroller) {
      return;
    }

    shouldStickToBottomRef.current = true;
    setShowNewMessagesPill(false);

    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      return;
    }

    scroller.scrollTop = scroller.scrollHeight;
  }, []);

  const handleChatScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (event) => {
      historyWindow.handleScroll(event);
      const nextShouldStick = isScrolledNearBottom(
        event.currentTarget,
        CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD,
      );
      shouldStickToBottomRef.current = nextShouldStick;
      if (nextShouldStick) {
        setShowNewMessagesPill(false);
      }
    },
    [historyWindow],
  );

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
    if (selectedModel) {
      applyContextUsageSnapshot({
        providerID: selectedModel.providerId,
        modelID: selectedModel.modelId,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
        },
      });
    }

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

  const abortActiveStream = async (): Promise<void> => {
    if (!busy) {
      return;
    }

    abortRequestedRef.current = true;
    setStatus('Stopping…');

    const activeSessionID = sessionIDRef.current;
    if (!activeSessionID) {
      return;
    }

    try {
      await client.session.abort({ sessionID: activeSessionID });
    } catch (error) {
      abortRequestedRef.current = false;

      if (!mountedRef.current) {
        return;
      }

      console.warn('Failed to abort the active OpenCode session.', error);
      setStatus('Unable to stop current response.');
    }
  };

  useEffect(() => {
    if (!busy || typeof window === 'undefined') {
      return;
    }

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (!shouldAbortComposerKey({ key: event.key, isStreaming: busy })) {
        return;
      }

      event.preventDefault();
      void abortActiveStream();
    };

    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [busy, client]);
  const sendMessage = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy || !modelConnected) {
      return;
    }

    abortRequestedRef.current = false;
    setBusy(true);
    setStatus('Waiting for OpenCode…');
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        blocks: [{ kind: 'text', partID: `user-${Date.now()}-text`, text }],
      },
    ]);
    setInput('');
    dispatchDraft({ type: 'reset' });

    try {
      const activeSessionID = await ensureSession();
      if (abortRequestedRef.current) {
        setStatus('OpenCode is ready.');
        return;
      }

      const relevantEntities = await resolveRelevantEntities(text, 6);
      if (abortRequestedRef.current) {
        setStatus('OpenCode is ready.');
        return;
      }

      await injectMemoryContext(client, activeSessionID, relevantEntities);
      if (abortRequestedRef.current) {
        setStatus('OpenCode is ready.');
        return;
      }

      const stream = streamSessionEvents(client, activeSessionID);
      const consumeStream = (async () => {
        for await (const event of stream) {
          if (!mountedRef.current) {
            return;
          }

          if (
            event.type === 'token'
            || event.type === 'reasoning'
            || event.type === 'tool_call'
            || event.type === 'tool_result'
            || event.type === 'tool_error'
          ) {
            dispatchDraft({ type: 'event', event });
          } else if (event.type === 'context_usage') {
            applyContextUsageSnapshot({
              providerID: event.providerID,
              modelID: event.modelID,
              tokens: event.tokens,
            });
          } else if (event.type === 'file_written') {
            onFileWritten?.(event.path);
          } else if (event.type === 'error') {
            setStatus(abortRequestedRef.current ? 'OpenCode is ready.' : event.message);
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

      const aborted = abortRequestedRef.current;
      const partialBlocks = draftBlocksRef.current;
      const partialText = messageTextFromBlocks(partialBlocks).trim();
      const historyPage = await refreshHistory(activeSessionID);
      if (!mountedRef.current || sessionIDRef.current !== activeSessionID) {
        return;
      }

      if (aborted && partialText.length > 0) {
        const historyAlreadyHasPartial = historyPage?.messages.some(
          (message) =>
            message.role === 'assistant'
            && messageTextFromBlocks(message.blocks).trim() === partialText,
        );

        if (!historyAlreadyHasPartial) {
          setMessages((current) => [
            ...current,
            {
              id: `assistant-abort-${Date.now()}`,
              role: 'assistant',
              blocks: partialBlocks,
            },
          ]);
        }
      }

      dispatchDraft({ type: 'reset' });

      const assistantMessageRecord = historyPage?.messages
        .filter((message) => message.role === 'assistant')
        .at(-1);
      const assistantMessage = assistantMessageRecord
        ? messageTextFromBlocks(assistantMessageRecord.blocks)
        : undefined;
      const toolResults = (assistantMessageRecord?.blocks ?? []).flatMap((block) =>
        block.kind === 'tool' && block.state === 'completed' && typeof block.output === 'string'
          ? [{ name: block.name, output: block.output }]
          : [],
      );
      if (!aborted && assistantMessage && vaultPath) {
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
          blocks: [
            {
              kind: 'text',
              partID: `system-${Date.now()}-text`,
              text: error instanceof Error ? error.message : String(error),
            },
          ],
        },
      ]);
      setStatus('Chat hit an error.');
    } finally {
      abortRequestedRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (shouldAbortComposerKey({ key: event.key, isStreaming: busy })) {
      event.preventDefault();
      void abortActiveStream();
      return;
    }

    if (
      shouldSubmitComposerKey({
        key: event.key,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        isComposing: event.nativeEvent.isComposing,
      })
    ) {
      event.preventDefault();
      void sendMessage();
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
          <span className="tinker-chat-legend" title="Toggle thinking + tool disclosures (Alt+T)">
            ⌥T thinking
          </span>
          {contextUsage ? <ContextBadge {...contextUsage} /> : null}
          <Badge variant="default" size="small">
            {status}
          </Badge>
        </div>
      </header>

      <div className="tinker-chat-log-shell">
        <div
          className="tinker-chat-log"
          ref={setLogScroller}
          onScroll={handleChatScroll}
          tabIndex={-1}
        >
          {messages.length === 0 ? (
            <EmptyState
              title={modelConnected ? 'Start a conversation' : 'No model connected'}
              description={
                modelConnected
                  ? 'Ask Tinker a question. Messages stream from OpenCode over HTTP + SSE.'
                  : 'Connect an AI model in Settings before sending a message.'
              }
              icon={
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v8c0 1.38-1.12 2.5-2.5 2.5H10l-4 3v-3H6.5C5.12 17 4 15.88 4 14.5v-8Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
          ) : null}

          {historyWindow.renderedMessages.flatMap((message) =>
            message.blocks.map((block) => {
              if (block.kind === 'text') {
                return (
                  <ChatMessage
                    key={block.partID}
                    role={message.role}
                    text={block.text}
                    onOpenFileLink={onOpenFileLink}
                  />
                );
              }

              return (
                <MessageBlock
                  key={block.partID}
                  block={block}
                  isOpen={isDisclosureOpen(block.partID)}
                  onToggle={(next) => handleDisclosureToggle(block.partID, next)}
                />
              );
            }),
          )}

          {draftBlocks.length > 0
            ? draftBlocks.map((block) => {
                if (block.kind === 'text') {
                  return (
                    <ChatMessage
                      key={block.partID}
                      role="assistant"
                      text={block.text}
                      streaming
                      onOpenFileLink={onOpenFileLink}
                    />
                  );
                }

                return (
                  <MessageBlock
                    key={block.partID}
                    block={block}
                    isOpen={isDisclosureOpen(block.partID)}
                    onToggle={(next) => handleDisclosureToggle(block.partID, next)}
                  />
                );
              })
            : null}
        </div>

        {showNewMessagesPill ? (
          <div className="tinker-chat-scroll-pill">
            <ClickableBadge variant="info" size="small" onClick={() => scrollToBottom('smooth')}>
              New messages
            </ClickableBadge>
          </div>
        ) : null}
      </div>

      <div className={`tinker-composer${busy ? ' tinker-composer--busy' : ''}`}>
        <Textarea
          ref={composerRef}
          value={input}
          rows={4}
          resize="none"
          placeholder="Ask about the vault, your project, or the next change to make."
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={handleComposerKeyDown}
          disabled={busy || !modelConnected}
        />
        <div className="tinker-inline-actions tinker-composer-actions">
          <ModelPicker
            items={modelOptions}
            value={selectedModelId}
            onSelect={setSelectedModelId}
            loading={modelOptionsLoading}
            disabled={busy}
            emptyLabel="No models available in OpenCode."
          />
          {busy ? (
            <Button variant="danger" onClick={() => void abortActiveStream()}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={sendMessage} disabled={!modelConnected || input.trim().length === 0}>
              Send message
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
