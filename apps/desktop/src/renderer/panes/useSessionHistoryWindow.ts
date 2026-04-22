import { useCallback, useEffect, useMemo, useRef, useState, type UIEventHandler } from 'react';

export const DEFAULT_SESSION_HISTORY_WINDOW_SIZE = 100;
export const DEFAULT_SESSION_HISTORY_REVEAL_BATCH = 25;
export const DEFAULT_SESSION_HISTORY_SCROLL_THRESHOLD = 200;

type ScrollSnapshot = {
  readonly top: number;
  readonly height: number;
};

export type SessionHistoryCursor<TCursor> = {
  readonly before: TCursor | null;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly loadMore: () => Promise<void>;
};

export type UseSessionHistoryWindowOptions<TMessage, TCursor = string> = {
  readonly sessionId?: string | null;
  readonly messages: readonly TMessage[];
  readonly cursor?: TCursor | null;
  readonly hasMore?: boolean;
  readonly isLoading?: boolean;
  readonly loadMore?: (cursor: TCursor) => Promise<void>;
  readonly windowSize?: number;
  readonly revealBatch?: number;
  readonly scrollThreshold?: number;
};

export type UseSessionHistoryWindowResult<TMessage, TCursor = string> = {
  readonly renderedMessages: readonly TMessage[];
  readonly range: {
    readonly start: number;
    readonly end: number;
    readonly total: number;
  };
  readonly cursor: SessionHistoryCursor<TCursor>;
  readonly revealOlder: () => void;
  readonly handleScroll: UIEventHandler<HTMLElement>;
  readonly setScroller: (node: HTMLElement | null) => void;
};

const scheduleFrame = (callback: () => void): void => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
    return;
  }

  setTimeout(callback, 0);
};

const takeScrollSnapshot = (scroller: HTMLElement | null): ScrollSnapshot | null => {
  if (!scroller) {
    return null;
  }

  return {
    top: scroller.scrollTop,
    height: scroller.scrollHeight,
  };
};

export const getInitialSessionHistoryStart = (total: number, windowSize: number): number => {
  return total > windowSize ? total - windowSize : 0;
};

export const getNextSessionHistoryStartForReveal = (currentStart: number, revealBatch: number): number => {
  return Math.max(0, currentStart - revealBatch);
};

export const getNextSessionHistoryStartForAppend = (input: {
  readonly currentStart: number;
  readonly previousTotal: number;
  readonly nextTotal: number;
  readonly windowSize: number;
}): number => {
  const previousTailStart = getInitialSessionHistoryStart(input.previousTotal, input.windowSize);
  const nextTailStart = getInitialSessionHistoryStart(input.nextTotal, input.windowSize);

  if (input.currentStart >= previousTailStart) {
    return nextTailStart;
  }

  return Math.min(input.currentStart, nextTailStart);
};

export const getNextSessionHistoryStartAfterOlderLoad = (input: {
  readonly previousStart: number;
  readonly previousTotal: number;
  readonly nextTotal: number;
  readonly previousRendered: number;
  readonly revealBatch: number;
}): number => {
  const growth = input.nextTotal - input.previousTotal;
  if (growth <= 0) {
    return input.previousStart;
  }

  if (input.previousStart > 0) {
    return input.previousStart + growth;
  }

  const target = Math.min(input.nextTotal, input.previousRendered + input.revealBatch);
  return Math.max(0, input.nextTotal - target);
};

export const getPreservedScrollTop = (input: {
  readonly beforeTop: number;
  readonly beforeHeight: number;
  readonly afterHeight: number;
}): number => {
  return input.beforeTop + (input.afterHeight - input.beforeHeight);
};

export const useSessionHistoryWindow = <TMessage, TCursor = string>({
  sessionId = null,
  messages,
  cursor = null,
  hasMore,
  isLoading = false,
  loadMore,
  windowSize = DEFAULT_SESSION_HISTORY_WINDOW_SIZE,
  revealBatch = DEFAULT_SESSION_HISTORY_REVEAL_BATCH,
  scrollThreshold = DEFAULT_SESSION_HISTORY_SCROLL_THRESHOLD,
}: UseSessionHistoryWindowOptions<TMessage, TCursor>): UseSessionHistoryWindowResult<TMessage, TCursor> => {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const windowStartRef = useRef(getInitialSessionHistoryStart(messages.length, windowSize));
  const previousSessionRef = useRef<string | null>(sessionId);
  const previousTotalRef = useRef(messages.length);
  const pendingLoadRef = useRef<{
    previousStart: number;
    previousTotal: number;
    previousRendered: number;
    previousFirstMessage: TMessage | null;
    snapshot: ScrollSnapshot | null;
  } | null>(null);
  const wasLoadingRef = useRef(isLoading);
  const [windowStart, setWindowStart] = useState(() => getInitialSessionHistoryStart(messages.length, windowSize));

  windowStartRef.current = windowStart;

  const resolvedHasMore = hasMore ?? cursor !== null;
  const firstMessage = messages[0] ?? null;

  const applyWithScrollRestore = useCallback((snapshot: ScrollSnapshot | null, apply: () => void) => {
    apply();

    if (!snapshot) {
      return;
    }

    scheduleFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }

      scroller.scrollTop = getPreservedScrollTop({
        beforeTop: snapshot.top,
        beforeHeight: snapshot.height,
        afterHeight: scroller.scrollHeight,
      });
    });
  }, []);

  useEffect(() => {
    if (previousSessionRef.current !== sessionId) {
      previousSessionRef.current = sessionId;
      previousTotalRef.current = messages.length;
      pendingLoadRef.current = null;
      setWindowStart(getInitialSessionHistoryStart(messages.length, windowSize));
      return;
    }

    const previousTotal = previousTotalRef.current;
    if (
      pendingLoadRef.current &&
      (isLoading || wasLoadingRef.current) &&
      messages.length !== previousTotal &&
      firstMessage !== pendingLoadRef.current.previousFirstMessage
    ) {
      const pending = pendingLoadRef.current;
      pendingLoadRef.current = null;
      previousTotalRef.current = messages.length;

      const nextStart = getNextSessionHistoryStartAfterOlderLoad({
        previousStart: pending.previousStart,
        previousTotal: pending.previousTotal,
        nextTotal: messages.length,
        previousRendered: pending.previousRendered,
        revealBatch,
      });

      applyWithScrollRestore(pending.snapshot, () => {
        setWindowStart(nextStart);
      });
      return;
    }

    const nextStart = getNextSessionHistoryStartForAppend({
      currentStart: windowStartRef.current,
      previousTotal,
      nextTotal: messages.length,
      windowSize,
    });

    previousTotalRef.current = messages.length;

    if (nextStart !== windowStartRef.current) {
      setWindowStart(nextStart);
    }
  }, [applyWithScrollRestore, firstMessage, isLoading, messages.length, revealBatch, sessionId, windowSize]);

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      pendingLoadRef.current = null;
    }

    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const requestLoadMore = useCallback(async () => {
    if (!loadMore || cursor === null || !resolvedHasMore || isLoading) {
      return;
    }

    pendingLoadRef.current = {
      previousStart: windowStartRef.current,
      previousTotal: messages.length,
      previousRendered: messages.length - windowStartRef.current,
      previousFirstMessage: firstMessage,
      snapshot: takeScrollSnapshot(scrollerRef.current),
    };

    try {
      await loadMore(cursor);
    } catch (error) {
      pendingLoadRef.current = null;
      throw error;
    }
  }, [cursor, firstMessage, isLoading, loadMore, messages.length, resolvedHasMore]);

  const revealOlder = useCallback(() => {
    const currentStart = windowStartRef.current;
    if (currentStart <= 0) {
      return;
    }

    const snapshot = takeScrollSnapshot(scrollerRef.current);
    const nextStart = getNextSessionHistoryStartForReveal(currentStart, revealBatch);

    applyWithScrollRestore(snapshot, () => {
      setWindowStart(nextStart);
    });
  }, [applyWithScrollRestore, revealBatch]);

  const handleScroll = useCallback<UIEventHandler<HTMLElement>>(
    (event) => {
      scrollerRef.current = event.currentTarget;
      if (event.currentTarget.scrollTop >= scrollThreshold) {
        return;
      }

      if (windowStartRef.current > 0) {
        revealOlder();
        return;
      }

      void requestLoadMore();
    },
    [requestLoadMore, revealOlder, scrollThreshold],
  );

  const setScroller = useCallback((node: HTMLElement | null) => {
    scrollerRef.current = node;
  }, []);

  const renderedMessages = useMemo(() => {
    if (windowStart <= 0) {
      return messages;
    }

    return messages.slice(windowStart);
  }, [messages, windowStart]);

  const cursorState = useMemo<SessionHistoryCursor<TCursor>>(
    () => ({
      before: cursor,
      hasMore: resolvedHasMore,
      isLoading,
      loadMore: requestLoadMore,
    }),
    [cursor, isLoading, requestLoadMore, resolvedHasMore],
  );

  return {
    renderedMessages,
    range: {
      start: windowStart,
      end: messages.length,
      total: messages.length,
    },
    cursor: cursorState,
    revealOlder,
    handleScroll,
    setScroller,
  };
};
