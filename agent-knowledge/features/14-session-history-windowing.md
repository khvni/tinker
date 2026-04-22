---
type: concept
tags: [chat, sessions, performance]
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** Perf feature; revisit once sessions exceed ~1000 messages. Do not start work until MVP ships.

# Feature 14 — Session history windowing

**Status**: spec drafted `[2026-04-19]`; reusable React hook shipped in TIN-152 `[2026-04-21]`. Full post-MVP session-surface integration still deferred.

## Why

Chat panes hit a wall on long sessions: rendering hundreds of messages blocks paint. OpenCode desktop (`anomalyco/opencode`) solved this cleanly with a bounded window + batch reveal. TIN-152 ports the core behavior into the current React chat surface without pulling in the larger post-MVP session stack.

## Rules

- Initial paint caps at `WINDOW_SIZE = 100` most-recent messages.
- Scrolling upward within `SCROLL_THRESHOLD = 200px` of the top reveals `BATCH = 25` cached older messages.
- When the rendered window is already at the oldest cached message and `cursor.before` exists, scrolling upward loads one older page via `session.messages({ before })` and reveals one batch from that page while preserving scroll position.
- The hook exports cursor state (`before`, `hasMore`, `isLoading`, `loadMore`) so richer post-MVP session surfaces can opt into buttons, jump controls, or host-backed pagination without reimplementing window math.

## API

```ts
const window = useSessionHistoryWindow({
  sessionId,
  messages,
  cursor,
  isLoading,
  loadMore: (before) => loadOlder(before),
});

// window: {
//   renderedMessages: Message[];
//   range: { start, end, total };
//   cursor: { before, hasMore, isLoading, loadMore };
//   revealOlder: () => void;
//   handleScroll: (event) => void;
//   setScroller: (node) => void;
// }
```

Scroll position preserved across reveals by reading `scrollTop` + `scrollHeight` before the append and correcting after (see OpenCode `session.tsx` `preserveScroll`).

## Persistence coupling

Host-service already paginates messages from OpenCode. The window only manages what's **rendered**. Messages stay in `@tinker/chat-client`'s cache (bounded by LRU eviction per session, per [[11-host-service]] §session-cache rules).

## Testing

- Synthetic session with 200 messages.
- Assert: initial paint length = 100.
- Assert: scroll-up by threshold reveals 25 cached messages.
- Assert: older-page load keeps viewport anchored by scroll-height delta.
- Assert: cursor API exposes `before`, `hasMore`, `isLoading`, and `loadMore`.

## Reference

- OpenCode desktop `packages/app/src/pages/session.tsx` § `createSessionHistoryWindow`.
