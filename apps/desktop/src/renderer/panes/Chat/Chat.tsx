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
  type ReactNode,
  type UIEventHandler,
} from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import {
  Badge,
  Button,
  ClickableBadge,
  ContextBadge,
  EmptyState,
  IconButton,
  ModelPicker,
  SelectFolderButton,
  Textarea,
} from '@tinker/design';
import {
  createChatHistoryWriter,
  findLatestChatHistorySessionId,
  injectActiveSkills,
  injectMemoryContext,
  readChatHistory,
  streamSessionEvents,
  type ChatHistoryWriter,
} from '@tinker/bridge';
import {
  appendMemoryCapture,
  createSession,
  findLatestSessionForFolder,
  getActiveMemoryPath,
  listSessionsForUser,
  subscribeMemoryPathChanged,
  updateLastActive,
  updateSession,
} from '@tinker/memory';
import { DEFAULT_SESSION_MODE, type SkillStore } from '@tinker/shared-types';
import type { OpencodeConnection } from '../../../bindings.js';
import {
  buildModelPickerItems,
  createWorkspaceClient,
  findModelOptionById,
  getOpencodeDirectory,
  pickDefaultModelOptionId,
  type WorkspaceModelOption,
} from '../../opencode.js';
import { AttachmentIcon } from './AttachmentIcon.js';
import { ChatMessage } from '../ChatMessage/index.js';
import { McpConnectionGate } from './components/McpConnectionGate/index.js';
import { resolvePreferredStoredModelId, resolveSelectedModelId } from './modelSelection.js';
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
import { replayChatHistory, type ChatMessageRecord } from './historyReplay.js';
import { useMcpConnectionGate } from './useMcpConnectionGate.js';

type ChatProps = {
  skillStore: SkillStore;
  currentUserId: string;
  modelConnected: boolean;
  opencode: OpencodeConnection;
  sessionFolderPath: string | null;
  vaultPath: string | null;
  activeSkillsRevision: number;
  sessionFolderBusy?: boolean;
  onSelectSessionFolder?: () => Promise<void> | void;
  onFileWritten?: (path: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenNewChat?: () => void;
  onMemoryCommitted?: () => void;
  paneIsActive?: boolean;
  onAttentionSignal?: (reason: 'notification-arrival') => void;
  modeToggleSlot?: ReactNode;
  reasoningPickerSlot?: ReactNode;
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
  currentUserId,
  modelConnected,
  opencode,
  sessionFolderPath,
  vaultPath,
  activeSkillsRevision,
  sessionFolderBusy = false,
  onSelectSessionFolder,
  onFileWritten,
  onOpenFileLink,
  onOpenNewChat,
  onMemoryCommitted,
  paneIsActive = true,
  onAttentionSignal,
  modeToggleSlot,
  reasoningPickerSlot,
}: ChatProps): JSX.Element => {
  const folderPickerAvailable = typeof onSelectSessionFolder === 'function';
  const awaitingFolder = !sessionFolderPath && folderPickerAvailable;
  const readyStatus = awaitingFolder
    ? 'Pick a folder to start a session.'
    : modelConnected
      ? 'OpenCode is ready.'
      : 'Connect an AI model in Settings to start chatting.';
  const client = useMemo(
    () => createWorkspaceClient(opencode, getOpencodeDirectory(vaultPath)),
    [opencode.baseUrl, opencode.password, opencode.username, vaultPath],
  );
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hydratingHistory, setHydratingHistory] = useState(false);
  const [draftBlocks, dispatchDraft] = useReducer(draftReducer, []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelOptions, setModelOptions] = useState<ReadonlyArray<WorkspaceModelOption>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [modelOptionsLoading, setModelOptionsLoading] = useState(true);
  const [status, setStatus] = useState(readyStatus);
  const [contextUsage, setContextUsage] = useState<ResolvedContextUsage | null>(null);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  const [requiresMcpConnectionGate, setRequiresMcpConnectionGate] = useState(false);
  // Global default applied where no per-disclosure override exists. ⌥T flips this and clears overrides.
  const [defaultDisclosureOpen, setDefaultDisclosureOpen] = useState(false);
  const [disclosureOverrides, setDisclosureOverrides] = useState<Record<string, boolean>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const sessionIDRef = useRef<string | null>(null);
  const sessionCreatedAtRef = useRef<string | null>(null);
  const historyWriterRef = useRef<ChatHistoryWriter | null>(null);
  const memoryPathRef = useRef<string | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRequestedRef = useRef(false);
  const contextUsageSnapshotRef = useRef<ContextUsageSnapshot | null>(null);
  const draftBlocksRef = useRef<Block[]>([]);
  const selectedModelRef = useRef<WorkspaceModelOption | undefined>(undefined);
  const attentionRaisedForDraftRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const lastTailSignatureRef = useRef('empty');
  const selectedModel = useMemo(() => findModelOptionById(modelOptions, selectedModelId), [modelOptions, selectedModelId]);
  const mcpConnectionGate = useMcpConnectionGate({
    enabled: !hydratingHistory && !awaitingFolder && requiresMcpConnectionGate,
    loadStatus: () => client.mcp.status(),
  });
  const composerBlocked = busy || hydratingHistory || awaitingFolder || !modelConnected || mcpConnectionGate.blocked;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const writer = historyWriterRef.current;
      historyWriterRef.current = null;
      if (writer) {
        void writer.dispose();
      }
      const activeSessionID = sessionIDRef.current;
      sessionIDRef.current = null;
      sessionCreatedAtRef.current = null;
      memoryPathRef.current = null;
      if (activeSessionID) {
        void client.session.abort({ sessionID: activeSessionID });
      }
    };
  }, [client]);

  useEffect(() => {
    if (!hydratingHistory) {
      setStatus(readyStatus);
    }
  }, [hydratingHistory, readyStatus]);

  useEffect(() => {
    let cancelled = false;

    setModelOptionsLoading(true);

    void (async () => {
      try {
        const [response, folderSession, priorSessions] = await Promise.all([
          client.config.providers(),
          sessionFolderPath ? findLatestSessionForFolder(currentUserId, sessionFolderPath) : Promise.resolve(null),
          sessionFolderPath ? listSessionsForUser(currentUserId) : Promise.resolve([]),
        ]);
        if (cancelled) {
          return;
        }

        const providers = response.data?.providers ?? [];
        const nextOptions = buildModelPickerItems(providers);
        const preferredStoredModelId = resolvePreferredStoredModelId(folderSession, priorSessions);
        const defaultSelectedId =
          pickDefaultModelOptionId(providers, response.data?.default ?? {}) ?? nextOptions[0]?.id;

        setModelOptions(nextOptions);
        setSelectedModelId((current) =>
          resolveSelectedModelId({
            options: nextOptions,
            currentSelectedId: current,
            preserveCurrent: sessionIDRef.current !== null,
            preferredStoredModelId,
            defaultSelectedId,
          }),
        );
      } catch (error) {
        console.warn('Failed to load model picker options from OpenCode.', error);
        if (cancelled) {
          return;
        }

        setModelOptions([]);
        setSelectedModelId(undefined);
      } finally {
        if (!cancelled) {
          setModelOptionsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, currentUserId, modelConnected, sessionFolderPath]);

  const activateSession = useCallback(
    (sessionID: string, sessionCreatedAt: string): void => {
      sessionIDRef.current = sessionID;
      sessionCreatedAtRef.current = sessionCreatedAt;
      setActiveSessionId(sessionID);

      const previousWriter = historyWriterRef.current;
      historyWriterRef.current = sessionFolderPath
        ? createChatHistoryWriter({
            folderPath: sessionFolderPath,
            userId: currentUserId,
            sessionId: sessionID,
          })
        : null;

      if (previousWriter) {
        void previousWriter.dispose();
      }
    },
    [currentUserId, sessionFolderPath],
  );

  useEffect(() => {
    memoryPathRef.current = null;
  }, [currentUserId]);

  useEffect(() => {
    return subscribeMemoryPathChanged(() => {
      memoryPathRef.current = null;
    });
  }, []);

  const resolveMemoryPath = useCallback(async (): Promise<string> => {
    if (!memoryPathRef.current) {
      memoryPathRef.current = await getActiveMemoryPath(currentUserId);
    }

    return memoryPathRef.current;
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;

    const existing = sessionIDRef.current;
    sessionIDRef.current = null;
    sessionCreatedAtRef.current = null;
    setActiveSessionId(null);
    abortRequestedRef.current = false;
    shouldStickToBottomRef.current = true;
    lastTailSignatureRef.current = 'empty';
    if (existing) {
      void client.session.abort({ sessionID: existing });
    }

    const previousWriter = historyWriterRef.current;
    historyWriterRef.current = null;
    if (previousWriter) {
      void previousWriter.dispose();
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
    setRequiresMcpConnectionGate(false);

    if (!sessionFolderPath) {
      setHydratingHistory(false);
      setRequiresMcpConnectionGate(false);
      setStatus(readyStatus);
      return () => {
        cancelled = true;
      };
    }

    setHydratingHistory(true);
    setStatus('Hydrating chat history…');

    void (async () => {
      try {
        const existingSession = await findLatestSessionForFolder(currentUserId, sessionFolderPath);
        const restoredSessionID =
          existingSession?.id
          ?? (await findLatestChatHistorySessionId({
            folderPath: sessionFolderPath,
            userId: currentUserId,
          }));

        if (!restoredSessionID || cancelled || !mountedRef.current) {
          if (!cancelled && mountedRef.current) {
            setRequiresMcpConnectionGate(true);
          }
          return;
        }

        const restoredCreatedAt = existingSession?.createdAt ?? new Date().toISOString();
        setRequiresMcpConnectionGate(false);
        activateSession(restoredSessionID, restoredCreatedAt);

        if (!existingSession) {
          try {
            await createSession({
              id: restoredSessionID,
              userId: currentUserId,
              folderPath: sessionFolderPath,
              createdAt: restoredCreatedAt,
              lastActiveAt: restoredCreatedAt,
              mode: DEFAULT_SESSION_MODE,
              ...(selectedModelRef.current ? { modelId: selectedModelRef.current.storedId } : {}),
            });
          } catch (error) {
            console.warn('Failed to restore the session row from chat history.', error);
          }
        }

        const records = await readChatHistory({
          folderPath: sessionFolderPath,
          userId: currentUserId,
          sessionId: restoredSessionID,
        });
        if (cancelled || !mountedRef.current || sessionIDRef.current !== restoredSessionID) {
          return;
        }

        setMessages(replayChatHistory(records));
        void updateLastActive(restoredSessionID, new Date().toISOString()).catch((error) => {
          console.warn('Failed to refresh the restored session timestamp.', error);
        });
      } catch (error) {
        console.warn('Failed to hydrate chat history from disk.', error);
        if (!cancelled && mountedRef.current) {
          setRequiresMcpConnectionGate(true);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setHydratingHistory(false);
          setStatus(readyStatus);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activateSession, activeSkillsRevision, client, currentUserId, readyStatus, sessionFolderPath]);

  useEffect(() => {
    if (!activeSessionId || !selectedModel) {
      return;
    }

    void updateSession(activeSessionId, { modelId: selectedModel.storedId }).catch((error) => {
      console.warn('Failed to persist the selected model for the active chat session.', error);
    });
  }, [activeSessionId, selectedModel]);

  useEffect(() => {
    draftBlocksRef.current = draftBlocks;
  }, [draftBlocks]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    if (paneIsActive) {
      attentionRaisedForDraftRef.current = false;
      return;
    }

    if (attentionRaisedForDraftRef.current || !busy || draftBlocks.length === 0) {
      return;
    }

    const hasAssistantActivity = draftBlocks.some((block) => {
      if (block.kind === 'text') {
        return block.text.trim().length > 0;
      }

      return true;
    });
    if (!hasAssistantActivity) {
      return;
    }

    attentionRaisedForDraftRef.current = true;
    onAttentionSignal?.('notification-arrival');
  }, [busy, draftBlocks, onAttentionSignal, paneIsActive]);

  useEffect(() => {
    if (!busy && draftBlocks.length === 0) {
      attentionRaisedForDraftRef.current = false;
    }
  }, [busy, draftBlocks.length]);

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
      if (!historyWriterRef.current && sessionFolderPath) {
        activateSession(sessionIDRef.current, sessionCreatedAtRef.current ?? new Date().toISOString());
      }

      return sessionIDRef.current;
    }

    const response = await client.session.create({ title: 'Tinker Chat' });
    const session = response.data;
    if (!session) {
      throw new Error('OpenCode did not return a session.');
    }

    const timestamp = new Date().toISOString();
    activateSession(session.id, timestamp);
    setRequiresMcpConnectionGate(false);

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

    if (sessionFolderPath) {
      try {
        await createSession({
          id: session.id,
          userId: currentUserId,
          folderPath: sessionFolderPath,
          createdAt: timestamp,
          lastActiveAt: timestamp,
          mode: DEFAULT_SESSION_MODE,
          ...(selectedModel ? { modelId: selectedModel.storedId } : {}),
        });
      } catch (error) {
        console.warn('Failed to persist the active chat session.', error);
      }
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
    if (!text || busy || hydratingHistory || !modelConnected || mcpConnectionGate.blocked) {
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
        setStatus(readyStatus);
        return;
      }

      const memoryPath = await resolveMemoryPath();
      if (abortRequestedRef.current) {
        setStatus(readyStatus);
        return;
      }

      await injectMemoryContext(client, activeSessionID, {
        memoryDirectory: memoryPath,
      });
      if (abortRequestedRef.current) {
        setStatus(readyStatus);
        return;
      }

      const historyWriter = historyWriterRef.current;
      const stream = streamSessionEvents(client, activeSessionID, {
        onEvent: (event) => {
          historyWriter?.appendEvent(event);
        },
      });
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
            setStatus(abortRequestedRef.current ? readyStatus : event.message);
          } else if (event.type === 'done') {
            setStatus(readyStatus);
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
      void updateLastActive(activeSessionID, new Date().toISOString()).catch((error) => {
        console.warn('Failed to refresh the active session timestamp.', error);
      });

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
      if (!aborted && assistantMessage) {
        const wroteMemory = await appendMemoryCapture({
          memoryDirectory: memoryPath,
          sessionCreatedAt: sessionCreatedAtRef.current ?? new Date().toISOString(),
          sessionId: activeSessionID,
          userPrompt: text,
          assistantMessage,
        });

        if (wroteMemory) {
          onMemoryCommitted?.();
        }
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
    <section className="tinker-pane tinker-pane--chat">
      <header className="tinker-chat-header">
        <div className="tinker-chat-header__left">
          <ModelPicker
            items={modelOptions}
            value={selectedModelId}
            onSelect={setSelectedModelId}
            loading={modelOptionsLoading}
            disabled={busy || hydratingHistory}
            emptyLabel="No models available in OpenCode."
          />
          {folderPickerAvailable ? (
            <SelectFolderButton
              folderPath={sessionFolderPath}
              loading={sessionFolderBusy}
              disabled={busy || hydratingHistory}
              onClick={() => void onSelectSessionFolder?.()}
            />
          ) : null}
          <span className="tinker-chat-legend" title="Toggle thinking + tool disclosures (Alt+T)">
            ⌥T thinking
          </span>
        </div>
        <div className="tinker-chat-header__right">
          {contextUsage ? <ContextBadge {...contextUsage} /> : null}
          <div className="tinker-chat-header__slot">
            {modeToggleSlot}
            {reasoningPickerSlot}
          </div>
          <Badge variant="default" size="small">
            {status}
          </Badge>
          {onOpenNewChat ? (
            <Button variant="ghost" size="s" onClick={onOpenNewChat}>
              New chat tab
            </Button>
          ) : null}
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
            awaitingFolder ? (
              <EmptyState
                title="Select a folder to start"
                description="The agent works inside a local folder. Use the “Select folder” button in the header to pick one."
                action={
                  <Button
                    variant="primary"
                    onClick={() => void onSelectSessionFolder?.()}
                    disabled={sessionFolderBusy}
                  >
                    {sessionFolderBusy ? 'Starting…' : 'Select folder'}
                  </Button>
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
            ) : mcpConnectionGate.visible ? (
              <McpConnectionGate
                services={mcpConnectionGate.services}
                errorMessage={mcpConnectionGate.errorMessage}
                onRetry={mcpConnectionGate.retry}
                onSkip={mcpConnectionGate.skip}
              />
            ) : (
              <EmptyState
                title={
                  hydratingHistory
                    ? 'Restoring chat history'
                    : modelConnected
                      ? 'Start a conversation'
                      : 'No model connected'
                }
                description={
                  hydratingHistory
                    ? 'Loading prior messages from the session folder before OpenCode resumes streaming.'
                    : modelConnected
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
            )
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

      <div className="tinker-composer-card__wrap">
        {mcpConnectionGate.notice ? (
          <Badge variant="info" size="small">
            {mcpConnectionGate.notice}
          </Badge>
        ) : null}
        <div
          className={`tinker-composer-card${busy ? ' tinker-composer-card--busy' : ''}`}
        >
          <div className="tinker-composer-card__body">
            <Textarea
              ref={composerRef}
              value={input}
              rows={4}
              resize="none"
              placeholder="Ask about the vault, your project, or the next change to make."
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={composerBlocked}
            />
          </div>
          <div className="tinker-composer-card__footer">
            <div className="tinker-composer-card__footer-left">
              <IconButton
                variant="ghost"
                size="s"
                icon={<AttachmentIcon />}
                label="Attachments coming soon"
                aria-disabled
                disabled
              />
            </div>
            <div className="tinker-composer-card__footer-right">
              {busy ? (
                <Button variant="danger" onClick={() => void abortActiveStream()}>
                  Stop
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={sendMessage}
                  disabled={composerBlocked || input.trim().length === 0}
                >
                  Send message
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
