---
type: concept
tags: [attention, notifications, ux]
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** `@tinker/attention` scaffold stays in-tree (tests passing) but not wired to MVP UI — MVP has one pane. Do not start wiring until MVP ships.

# Feature 12 — Workspace attention coordinator

**Status**: scaffold landed `[2026-04-20]`; pane-frame + sidebar wiring still pending. Depends on [[10-tinker-panes]] landing. Bound to [[D19]].

## Why

Notification UX in AI workspaces rots fast without central rules. cmux (`manaflow-ai/cmux`) solved this with `WorkspaceAttentionCoordinator` in `Sources/Panels/Panel.swift`. We port the rules — not the Swift code — into a TypeScript package that all Tinker panes (and the future workspace sidebar) route through.

## Rules (lifted from cmux)

### Flash reasons

```ts
type FlashReason =
  | 'notification-arrival'   // agent finished a turn / external service pinged
  | 'notification-dismiss'   // user cleared a notification elsewhere
  | 'manual-unread-dismiss'  // user clicked "Mark as read"
  | 'navigation'             // user jumped via command palette / keyboard
  | 'debug';                 // dev-only test trigger
```

Only `notification-arrival` can start a new unread state. Other reasons interact with existing state or render navigation affordances.

### Accents

```ts
type FlashAccent = 'notification-blue' | 'navigation-teal';
```

- `notification-*` reasons → `notification-blue` (strong glow, opacity 0.6, radius 6px)
- `navigation` → `navigation-teal` (subtle, opacity 0.14, radius 3px)

### Decision table

Given a pane id + reason + current focus:

| Reason | Focused? | Competing indicator on another pane? | Outcome |
|---|---|---|---|
| `notification-arrival` | yes | — | mark read; no flash |
| `notification-arrival` | no | — | add to `unreadPanelIDs`; flash blue |
| `navigation` | yes | any | no flash (already looking) |
| `navigation` | no | yes | no flash (blue wins) |
| `navigation` | no | no | flash teal briefly |
| `manual-unread-dismiss` | — | — | remove from `unreadPanelIDs`; flash blue; keep `focusedReadPanelID` |
| `notification-dismiss` | yes | — | remove from `unreadPanelIDs`; flash blue |

### Render hooks

Three surfaces subscribe:

1. **Pane edge ring** — renders inside the pane frame (cmux: `TmuxWorkspacePaneOverlayView`). Blue = unread, teal = navigation hint, both suppressed if pane is active.
2. **Tab strip dot** — small dot on the tab owning the pane.
3. **Sidebar workspace card badge** — count of unread panes; see [[13-workspace-sidebar]].

### Glow curve

`FocusFlashPattern.opacity(at: elapsed)` — cmux uses a custom curve, not CSS `transition`. Port to `requestAnimationFrame` w/ a hand-tuned curve. Curve shape:

- ramp-up 0 → peak over 120ms
- hold peak 180ms
- ramp-down peak → 0 over 420ms
- total ~720ms

Web equivalent: a Framer Motion spring works if we stay off CSS transitions (which stutter under React re-renders).

## API

```ts
// packages/attention/src/store.ts
type AttentionSignal = {
  workspaceId: string;
  paneId: string;
  reason: FlashReason;
};

type AttentionSnapshot = {
  unreadPanelIds: Set<string>;
  focusedReadPanelId: string | null;
  manualUnreadPanelIds: Set<string>;
  activeFlash: { paneId: string; reason: FlashReason; startedAt: number } | null;
};

export function createAttentionStore(): AttentionStore;
export function useAttentionSnapshot(store: AttentionStore): AttentionSnapshot;
export function useAttentionSignal(store: AttentionStore): (signal: AttentionSignal) => void;
export function usePaneAttentionState(store: AttentionStore, paneId: string): {
  unread: boolean;
  flash: null | { accent: FlashAccent; progress: number };
};
```

The store decides whether a signal produces a flash; renderers only consume snapshots.

## Implementation note `[2026-04-20]`

- `packages/attention` now ships a zustand-backed store keyed by `workspaceId` inside one coordinator instance. Active workspace selectors expose the current snapshot; sidebar/panes can still query any workspace explicitly.
- `unreadPaneIds` is treated as **notification-generated unread**. Final unread render state is `unreadPaneIds ∪ manualUnreadPaneIds`.
- `manual-unread-dismiss` clears both unread sources for a pane; `notification-dismiss` clears only notification unread so a user-authored manual unread marker survives.
- Flash lifecycle is in-memory only and auto-clears after the 720ms timing window; tests cover every row in the decision table.

## Persistence

- `unreadPanelIds` + `manualUnreadPanelIds` persist across app restart (via host.attention endpoints, not local).
- `activeFlash` is in-memory only.
- Host side stores per-workspace: `{ panelId: string; lastNotificationAt: number; dismissedAt: number | null }`.

## Follow-ups

- Sound on `notification-arrival` — optional, opt-in, configurable per pane kind.
- Auto-reorder workspace sidebar on arrival ([[13-workspace-sidebar]] implements this via `attention.onChange`).
- macOS Dock badge count on unread pane count — [[15-connection-gate]] owns the integration point with `@tauri-apps/plugin-notification`.

## Reference

- cmux: `Sources/Panels/Panel.swift` §`WorkspaceAttentionCoordinator` (read from `.local-reference/` if present, otherwise from GitHub at `manaflow-ai/cmux` @main).
- cmux: `Sources/WorkspaceContentView.swift` §`TmuxWorkspacePaneOverlayView` for the glow renderer.
