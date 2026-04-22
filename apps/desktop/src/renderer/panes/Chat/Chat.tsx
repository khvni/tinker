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
} from 'react';
import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import {
  ContextBadge,
  Badge,
  Button,
  EmptyState,
  ModelPicker,
  Textarea,
} from '@tinker/design';
import { injectActiveSkills, injectMemoryContext, streamSessionEvents } from '@tinker/bridge';
import {
  createSession as createStoredSession,
  getSession as getStoredSession,
  listSessionsForUser,
  resolveRelevantEntities,
  updateSession as updateStoredSession,
  type SessionUpdate,
} from '@tinker/memory';
import {
  DEFAULT_REASONING_LEVEL,
  DEFAULT_SESSION_MODE,
  type ReasoningLevel,
  type Session,
  type SessionMode,
  type SkillStore,
} from '@tinker/shared-types';
import type { OpencodeConnection } from '../../../bindings.js';
import { captureConversationMemory } from '../../memory.js';
import {
  buildModelPickerItems,
  createWorkspaceClient,
  findModelOptionById,
  findModelOptionByStoredId,
  getOpencodeDirectory,
  pickDefaultModelOptionId,
  resolveReasoningVariant,
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
import { ModeToggle } from './components/ModeToggle/index.js';
import { ReasoningPicker } from './components/ReasoningPicker/index.js';
import { draftReducer } from './draftReducer.js';

type ChatMessageRecord = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blocks: Block[];
};

type RawHistoryMessage = {
  info: Message;
  parts: Part[];
};

type HistoryPage = {
  messages: ChatMessageRecord[];
  cursor: string | null;
  contextTokens: number;
};

type ChatProps = {
  skillStore: SkillStore;
  modelConnected: boolean;
  opencode: OpencodeConnection;
  currentUserId: Session['userId'];
  paneSessionId?: Session['id'];
  vaultPath: string | null;
  activeSkillsRevision: number;
  onPersistSessionId?: (sessionId: Session['id']) => void;
  onFileWritten?: (path: string) => void;
  onOpenNewChat?: () => void;
  onMemoryCommitted?: () => void;
};

const formatMessages = (messages: ReadonlyArray<RawHistoryMessage>): ChatMessageRecord[] => {
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
      const placeholder =
        info.role === 'assistant'
          ? 'Response contained only non-text output.'
          : 'Message sent.';
      blocks.push({ kind: 'text', partID: `placeholder-${info.id}`, text: placeholder });
    }

    return {
      id: info.id,
      role: info.role,
      blocks,
    };
  });
};

const readAssistantTokens = (message: Message | undefined): number => {
  if (message?.role !== 'assistant') {
    return 0;
  }

  const tokens = (message as Message & {
    tokens?: {
      total?: number;
      input?: number;
      output?: number;
      reasoning?: number;
    };
  }).tokens;

  if (!tokens) {
    return 0;
  }

  if (typeof tokens.total === 'number') {
    return tokens.total;
  }

  return (tokens.input ?? 0) + (tokens.output ?? 0) + (tokens.reasoning ?? 0);
};

const extractContextTokens = (messages: ReadonlyArray<RawHistoryMessage>): number => {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.info.role === 'assistant');

  return readAssistantTokens(lastAssistantMessage?.info);
};

const mergeHistoryMessages = (
  olderMessages: readonly ChatMessageRecord[],
  newerMessages: readonly ChatMessageRecord[],
): ChatMessageRecord[] => {
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
    styles.lineHeight === 'normal'
      ? fontSize * 1.5
      : readPixelValue(styles.lineHeight, fontSize * 1.5);

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

const buildReasoningLookup = (
  sessions: ReadonlyArray<Session>,
): Record<string, ReasoningLevel> => {
  const lookup: Record<string, ReasoningLevel> = {};

  for (const session of sessions) {
    if (!session.modelId || !session.reasoningLevel || lookup[session.modelId] !== undefined) {
      continue;
    }

    lookup[session.modelId] = session.reasoningLevel;
  }

  return lookup;
};

const mergeStoredSession = (
  session: Session,
  update: SessionUpdate,
  lastActiveAt: string,
): Session => {
  return {
    ...session,
    lastActiveAt,
    folderPath: update.folderPath ?? session.folderPath,
    mode: update.mode ?? session.mode,
    ...(update.modelId !== undefined
      ? update.modelId === null
        ? {}
        : { modelId: update.modelId }
      : session.modelId
        ? { modelId: session.modelId }
        : {}),
    ...(update.reasoningLevel !== undefined
      ? update.reasoningLevel === null
        ? {}
        : { reasoningLevel: update.reasoningLevel }
      : session.reasoningLevel
        ? { reasoningLevel: session.reasoningLevel }
        : {}),
  };
};

export const Chat = ({
  skillStore,
  modelConnected,
  opencode,
  currentUserId,
  paneSessionId,
  vaultPath,
  activeSkillsRevision,
  onPersistSessionId,
  onFileWritten,
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
  const [persistedModelStoredId, setPersistedModelStoredId] = useState<string>();
  const [selectedMode, setSelectedMode] = useState<SessionMode>(DEFAULT_SESSION_MODE);
  const [selectedReasoningLevel, setSelectedReasoningLevel] = useState<ReasoningLevel>(
    DEFAULT_REASONING_LEVEL,
  );
  const [modelOptionsLoading, setModelOptionsLoading] = useState(true);
  const [sessionPreferencesReady, setSessionPreferencesReady] = useState(false);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [contextTokens, setContextTokens] = useState(0);
  const [status, setStatus] = useState(
    modelConnected
      ? 'OpenCode is ready.'
      : 'Connect an AI model in Settings to start chatting.',
  );
  const [defaultDisclosureOpen, setDefaultDisclosureOpen] = useState(false);
  const [disclosureOverrides, setDisclosureOverrides] = useState<Record<string, boolean>>({});
  const mountedRef = useRef(true);
  const sessionIDRef = useRef<string | null>(null);
  const storedSessionRef = useRef<Session | null>(null);
  const reasoningByModelRef = useRef<Record<string, ReasoningLevel>>({});
  const previousModelStoredIdRef = useRef<string | null>(null);
  const memoryCommitRef = useRef<Promise<void>>(Promise.resolve());
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRequestedRef = useRef(false);
  const draftBlocksRef = useRef<Block[]>([]);
  const selectedModel = useMemo(
    () => findModelOptionById(modelOptions, selectedModelId),
    [modelOptions, selectedModelId],
  );
  const selectedReasoningVariant = useMemo(
    () =>
      resolveReasoningVariant(
        selectedModel,
        selectedModel?.supportsReasoning ? selectedReasoningLevel : undefined,
      ),
    [selectedModel, selectedReasoningLevel],
  );
  const contextUsage = useMemo(() => {
    if (!selectedModel?.contextWindow) {
      return null;
    }

    return {
      percent:
        selectedModel.contextWindow === 0
          ? 0
          : (contextTokens / selectedModel.contextWindow) * 100,
      tokens: contextTokens,
      windowSize: selectedModel.contextWindow,
      model: `${selectedModel.providerName} ${selectedModel.name}`,
    };
  }, [contextTokens, selectedModel]);

  const persistSessionUpdate = useCallback(async (update: SessionUpdate): Promise<void> => {
    const currentSession = storedSessionRef.current;
    if (!currentSession) {
      return;
    }

    const lastActiveAt = new Date().toISOString();

    try {
      await updateStoredSession(currentSession.id, {
        ...update,
        lastActiveAt,
      });
      storedSessionRef.current = mergeStoredSession(currentSession, update, lastActiveAt);

      if (update.modelId !== undefined) {
        setPersistedModelStoredId(update.modelId ?? undefined);
      }
    } catch (error) {
      console.warn('Failed to persist chat session settings.', error);
    }
  }, []);

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
    setStatus(
      modelConnected
        ? 'OpenCode is ready.'
        : 'Connect an AI model in Settings to start chatting.',
    );
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
        const nextSelectedId =
          pickDefaultModelOptionId(providers, response.data?.default ?? {}) ??
          nextOptions[0]?.id;

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
    let cancelled = false;

    setSessionPreferencesReady(false);

    void (async () => {
      try {
        const recentSessions = await listSessionsForUser(currentUserId);
        if (cancelled) {
          return;
        }

        reasoningByModelRef.current = buildReasoningLookup(recentSessions);

        let nextSessionId = paneSessionId ?? crypto.randomUUID();
        let storedSession = paneSessionId
          ? await getStoredSession(paneSessionId)
          : null;

        if (cancelled) {
          return;
        }

        if (storedSession?.userId !== currentUserId) {
          storedSession = null;
          nextSessionId = crypto.randomUUID();
        }

        const timestamp = new Date().toISOString();

        if (!storedSession) {
          const inheritedModelId = recentSessions.find((session) => session.modelId)?.modelId;
          const inheritedReasoningLevel = inheritedModelId
            ? reasoningByModelRef.current[inheritedModelId]
            : undefined;

          storedSession = {
            id: nextSessionId,
            userId: currentUserId,
            folderPath: vaultPath ?? '',
            createdAt: timestamp,
            lastActiveAt: timestamp,
            mode: recentSessions[0]?.mode ?? DEFAULT_SESSION_MODE,
            ...(inheritedModelId ? { modelId: inheritedModelId } : {}),
            ...(inheritedReasoningLevel
              ? { reasoningLevel: inheritedReasoningLevel }
              : {}),
          };
          await createStoredSession(storedSession);

          if (nextSessionId !== paneSessionId) {
            onPersistSessionId?.(nextSessionId);
          }
        } else {
          const nextFolderPath = vaultPath ?? '';
          const update: SessionUpdate = {
            ...(storedSession.folderPath !== nextFolderPath
              ? { folderPath: nextFolderPath }
              : {}),
            lastActiveAt: timestamp,
          };

          await updateStoredSession(storedSession.id, update);
          storedSession = mergeStoredSession(storedSession, update, timestamp);
        }

        if (cancelled) {
          return;
        }

        storedSessionRef.current = storedSession;
        setPersistedModelStoredId(storedSession.modelId);
        setSelectedMode(storedSession.mode);
        setSelectedReasoningLevel(
          storedSession.reasoningLevel ?? DEFAULT_REASONING_LEVEL,
        );

        if (storedSession.modelId && storedSession.reasoningLevel) {
          reasoningByModelRef.current[storedSession.modelId] =
            storedSession.reasoningLevel;
        }
      } catch (error) {
        console.warn('Failed to initialize chat session persistence.', error);
        storedSessionRef.current = null;
        setPersistedModelStoredId(undefined);
        setSelectedMode(DEFAULT_SESSION_MODE);
        setSelectedReasoningLevel(DEFAULT_REASONING_LEVEL);
      } finally {
        if (!cancelled) {
          setSessionPreferencesReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, onPersistSessionId, paneSessionId, vaultPath]);

  useEffect(() => {
    const existing = sessionIDRef.current;
    sessionIDRef.current = null;
    abortRequestedRef.current = false;
    if (existing) {
      void client.session.abort({ sessionID: existing });
    }
    setMessages([]);
    setContextTokens(0);
    dispatchDraft({ type: 'reset' });
    setHistoryCursor(null);
    setHistoryLoading(false);
    setDisclosureOverrides({});
    setDefaultDisclosureOpen(false);
  }, [activeSkillsRevision, client]);

  useEffect(() => {
    draftBlocksRef.current = draftBlocks;
  }, [draftBlocks]);

  useLayoutEffect(() => {
    syncComposerHeight(composerRef.current);
  }, [input]);

  useEffect(() => {
    if (!modelWarning || typeof window === 'undefined') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setModelWarning(null);
    }, 5_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [modelWarning]);

  useEffect(() => {
    if (!sessionPreferencesReady || modelOptionsLoading) {
      return;
    }

    if (modelOptions.length === 0) {
      setSelectedModelId(undefined);
      return;
    }

    if (persistedModelStoredId) {
      const persistedOption = findModelOptionByStoredId(
        modelOptions,
        persistedModelStoredId,
      );
      if (persistedOption) {
        setSelectedModelId((current) =>
          current === persistedOption.id ? current : persistedOption.id,
        );
        return;
      }

      const fallbackOption = modelOptions[0];
      if (!fallbackOption) {
        return;
      }

      setPersistedModelStoredId(fallbackOption.storedId);
      setSelectedModelId(fallbackOption.id);
      setModelWarning(
        `Saved model unavailable. Switched to ${fallbackOption.providerName} ${fallbackOption.name}.`,
      );
      void persistSessionUpdate({ modelId: fallbackOption.storedId });
      return;
    }

    setSelectedModelId((current) => {
      if (current && modelOptions.some((option) => option.id === current)) {
        return current;
      }

      return modelOptions[0]?.id;
    });
  }, [
    modelOptions,
    modelOptionsLoading,
    persistSessionUpdate,
    persistedModelStoredId,
    sessionPreferencesReady,
  ]);

  useEffect(() => {
    const nextModelStoredId = selectedModel?.storedId ?? null;
    if (nextModelStoredId === previousModelStoredIdRef.current) {
      return;
    }

    previousModelStoredIdRef.current = nextModelStoredId;

    if (!selectedModel?.supportsReasoning || !nextModelStoredId) {
      return;
    }

    setSelectedReasoningLevel(
      reasoningByModelRef.current[nextModelStoredId] ?? DEFAULT_REASONING_LEVEL,
    );
  }, [selectedModel]);

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

  const isDisclosureOpen = (partID: string): boolean => {
    const override = disclosureOverrides[partID];
    return override === undefined ? defaultDisclosureOpen : override;
  };

  const handleDisclosureToggle = useCallback((partID: string, next: boolean): void => {
    setDisclosureOverrides((current) => ({ ...current, [partID]: next }));
  }, []);

  const loadHistoryPage = useCallback(
    async (sessionID: string, before?: string): Promise<HistoryPage> => {
      const history = await client.session.messages({
        sessionID,
        limit: 100,
        ...(before ? { before } : {}),
      });
      const historyMessages = history.data ?? [];

      return {
        messages: formatMessages(historyMessages),
        cursor: history.response.headers.get('x-next-cursor') ?? null,
        contextTokens: extractContextTokens(historyMessages),
      };
    },
    [client],
  );

  const refreshHistory = useCallback(
    async (sessionID: string): Promise<HistoryPage | null> => {
      const page = await loadHistoryPage(sessionID);
      if (!mountedRef.current || sessionIDRef.current !== sessionID) {
        return null;
      }

      setMessages(page.messages);
      setHistoryCursor(page.cursor);
      setContextTokens(page.contextTokens);
      return page;
    },
    [loadHistoryPage],
  );

  const loadOlderHistory = useCallback(
    async (before: string): Promise<void> => {
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
    },
    [historyLoading, loadHistoryPage],
  );

  const historyWindow = useSessionHistoryWindow({
    sessionId: sessionIDRef.current,
    messages,
    cursor: historyCursor,
    isLoading: historyLoading,
    loadMore: loadOlderHistory,
  });

  const setLogScroller = useCallback(
    (node: HTMLDivElement | null): void => {
      chatLogRef.current = node;
      historyWindow.setScroller(node);
    },
    [historyWindow],
  );

  const ensureSession = useCallback(async (): Promise<string> => {
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
  }, [client, skillStore]);

  const abortActiveStream = useCallback(async (): Promise<void> => {
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
  }, [busy, client]);

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
  }, [abortActiveStream, busy]);

  const handleModeChange = useCallback(
    (nextMode: SessionMode): void => {
      setSelectedMode(nextMode);
      void persistSessionUpdate({ mode: nextMode });
    },
    [persistSessionUpdate],
  );

  const handleModelSelect = useCallback(
    (nextModelId: string): void => {
      const nextModel = findModelOptionById(modelOptions, nextModelId);
      if (!nextModel) {
        return;
      }

      setModelWarning(null);
      setSelectedModelId(nextModel.id);
      setPersistedModelStoredId(nextModel.storedId);

      if (!nextModel.supportsReasoning) {
        void persistSessionUpdate({ modelId: nextModel.storedId });
        return;
      }

      const nextReasoningLevel =
        reasoningByModelRef.current[nextModel.storedId] ?? DEFAULT_REASONING_LEVEL;
      setSelectedReasoningLevel(nextReasoningLevel);
      void persistSessionUpdate({
        modelId: nextModel.storedId,
        reasoningLevel: nextReasoningLevel,
      });
    },
    [modelOptions, persistSessionUpdate],
  );

  const handleReasoningChange = useCallback(
    (nextReasoningLevel: ReasoningLevel): void => {
      if (!selectedModel?.supportsReasoning) {
        return;
      }

      reasoningByModelRef.current[selectedModel.storedId] = nextReasoningLevel;
      setSelectedReasoningLevel(nextReasoningLevel);
      void persistSessionUpdate({ reasoningLevel: nextReasoningLevel });
    },
    [persistSessionUpdate, selectedModel],
  );

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
            event.type === 'token' ||
            event.type === 'reasoning' ||
            event.type === 'tool_call' ||
            event.type === 'tool_result' ||
            event.type === 'tool_error'
          ) {
            dispatchDraft({ type: 'event', event });
          } else if (event.type === 'file_written') {
            onFileWritten?.(event.path);
          } else if (event.type === 'error') {
            setStatus(abortRequestedRef.current ? 'OpenCode is ready.' : event.message);
          } else if (event.type === 'done') {
            setStatus('OpenCode is ready.');
          }
        }
      })();

      const promptRequest = {
        sessionID: activeSessionID,
        parts: [{ type: 'text', text }],
        agent: selectedMode,
        ...(selectedReasoningVariant ? { variant: selectedReasoningVariant } : {}),
        ...(selectedModel
          ? {
              model: {
                providerID: selectedModel.providerId,
                modelID: selectedModel.modelId,
              },
            }
          : {}),
      } as Parameters<typeof client.session.prompt>[0];

      await client.session.prompt(promptRequest);
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
            message.role === 'assistant' &&
            messageTextFromBlocks(message.blocks).trim() === partialText,
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
        block.kind === 'tool' &&
        block.state === 'completed' &&
        typeof block.output === 'string'
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
      <header className="tinker-pane-header tinker-chat-header">
        <div>
          <p className="tinker-eyebrow">Chat</p>
          <h2>Talk to OpenCode directly</h2>
        </div>
        <div className="tinker-inline-actions tinker-chat-header-controls">
          <ModelPicker
            items={modelOptions}
            value={selectedModelId}
            onSelect={handleModelSelect}
            loading={modelOptionsLoading}
            disabled={busy || !sessionPreferencesReady}
            emptyLabel="No models available in OpenCode."
          />
          <ModeToggle value={selectedMode} onChange={handleModeChange} />
          {selectedModel?.supportsReasoning ? (
            <ReasoningPicker
              value={selectedReasoningLevel}
              onChange={handleReasoningChange}
            />
          ) : null}
          {contextUsage ? (
            <ContextBadge
              percent={contextUsage.percent}
              tokens={contextUsage.tokens}
              windowSize={contextUsage.windowSize}
              model={contextUsage.model}
            />
          ) : null}
          <Badge
            variant={selectedMode === 'plan' ? 'info' : 'default'}
            size="small"
          >
            {selectedMode === 'plan' ? 'Plan · read-only' : 'Build · can edit'}
          </Badge>
          {modelWarning ? (
            <Badge variant="warning" size="small">
              {modelWarning}
            </Badge>
          ) : null}
          <span
            className="tinker-chat-legend"
            title="Toggle thinking + tool disclosures (Alt+T)"
          >
            ⌥T thinking
          </span>
          <Badge variant="default" size="small">
            {status}
          </Badge>
          {onOpenNewChat ? (
            <Button variant="secondary" size="s" onClick={onOpenNewChat}>
              New chat tab
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className="tinker-chat-log"
        ref={setLogScroller}
        onScroll={historyWindow.handleScroll}
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
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
          {busy ? (
            <Button variant="danger" onClick={() => void abortActiveStream()}>
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={sendMessage}
              disabled={!modelConnected || input.trim().length === 0}
            >
              Send message
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
