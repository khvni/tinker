---
type: concept
tags: [chat, sessions, performance]
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** Perf feature; revisit once sessions exceed ~1000 messages. Do not start work until MVP ships.

# Feature 14 — Session history windowing

**Status**: spec drafted `[2026-04-19]`. Integrates with [[11-host-service]] session endpoints + Chat pane (post-migration per [[10-tinker-panes]]).

## Why

Chat panes hit a wall on long sessions: rendering 200+ turns blocks paint. OpenCode desktop (`anomalyco/opencode`) solved this cleanly with a bounded window + batch reveal. Port the pattern.

## Rules

- Initial paint caps at `INITIAL_TURNS = 10` most-recent user turns.
- Scrolling upward within `SCROLL_THRESHOLD = 200px` of the top reveals `BATCH = 8` older turns.
- Prefetch kicks in when `BATCH * 2` turns remain above the window. Prefetch cooldown `400ms`; prefetch gives up after `PREFETCH_NO_GROWTH_LIMIT = 2` consecutive responses with zero new turns (the session has been fully loaded).
- "Load all history" button exists but does NOT trigger a single paint — it reveals all cached turns first, then pages older history one batch at a time.

## API

```ts
// In the Chat pane renderer
const window = useSessionHistoryWindow({
  sessionId,
  messagesReady,
  loaded,
  visibleUserMessages,
  historyHasMore,
  historyIsLoading,
  loadOlder: (sessionId) => hostClient.session.loadOlder(sessionId),
  userScrolled,
  scroller,
});

// window: {
//   renderedMessages: UserMessage[];
//   loadAndRevealAll: () => Promise<void>;
//   revealMoreTurns: () => void;
// }
```

Scroll position preserved across reveals by reading `scrollTop` + `scrollHeight` before the append and correcting after (see OpenCode `session.tsx` `preserveScroll`).

## Persistence coupling

Host-service already paginates messages from OpenCode. The window only manages what's **rendered**. Messages stay in `@tinker/chat-client`'s cache (bounded by LRU eviction per session, per [[11-host-service]] §session-cache rules).

## Testing

- Fake scroller + synthetic session with 200 turns.
- Assert: initial paint length = 10.
- Assert: scroll-up by threshold reveals 8.
- Assert: `loadAndRevealAll` drains cache first, then pages history in batches.
- Assert: `prefetchNoGrowth` bails after 2 empty responses.

## Reference

- OpenCode desktop `packages/app/src/pages/session.tsx` § `createSessionHistoryWindow`.
