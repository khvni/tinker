---
type: concept
tags: [panes, layout, design-system]
mvp_linked: true
---

> **[2026-04-21] Architectural reference retained; MVP execution continues under [[20-mvp-panes-workspace]] (M1) per [[decisions]] D25.** This file stays canonical for `@tinker/panes` architecture + API shape. Atomic MVP tasks live in `context/tasks.md` §M1.

# Feature 10 — `@tinker/panes` workspace layout

**Status**: `[2026-04-19]` scaffold shipped — package + demo route at `?route=panes-demo`. Migration of existing panes pending (parallel-agent work).

**Supersedes**: the `dockview-react` portion of [[07-workspace-persistence]]. Workspace persistence shape changes in [[D16]].

## Why

Dockview was VS-Code-style docking — floating windows, tab-group merging, docking hinting. Tinker's PRD asks for split panes, movable tabs, and persisted layout. The cmux + Superset pattern (recursive binary split tree + single tab level) is a better fit for:
- workspace-as-primary-nav ([[13-workspace-sidebar]])
- cmux-style attention rings per pane ([[12-attention-coordinator]])
- typed pane payloads (each `kind` carries its own `TData`)
- trivial JSON-round-trip serialization for layout persistence

## Scope

- Recursive binary split tree (`row` | `column`) with bounded ratio 0.1..0.9.
- One layout tree per tab; flat list of tabs per workspace.
- Each tab has one active pane; each workspace has one active tab.
- Pane payloads are generic (`Pane<TData>`). Renderers live in a `PaneRegistry<TData>` keyed by `pane.kind`.
- zustand-backed store exposes atomic actions; React bindings via `useSyncExternalStore`.
- HTML5 drag-and-drop for tab reorder + edge-docking panes.
- Keyboard: arrow keys between tabs, arrow keys on a resize handle, Cmd/Ctrl-W closes tab.
- Spatial neighbor finder (`getSpatialNeighborStackId`) for future shortcut-driven focus moves.

## Out of scope (for this feature)

- Floating / undocked windows.
- Cross-tab tab groups (tabs inside splits).
- Maximize / minimize (trivial add, ship when a pane asks for it).
- A default set of panes — panes are app-level concerns (register in `apps/desktop`).

## Types

```ts
type LayoutNode =
  | { kind: 'leaf'; paneId: string }
  | { kind: 'split'; orientation: 'row' | 'column'; a: LayoutNode; b: LayoutNode; ratio?: number };

type Pane<TData> = { id: string; kind: string; title?: string; pinned?: boolean; data: TData };

type Tab<TData> = {
  id: string;
  title?: string;
  createdAt: number;
  activePaneId: string | null;
  layout: LayoutNode;
  panes: Record<string, Pane<TData>>;
};

type WorkspaceState<TData> = { version: 1; tabs: Tab<TData>[]; activeTabId: string | null };
```

## Actions

| Action | Semantics |
|---|---|
| `openTab({ id, pane, title?, activate? })` | Create tab seeded with one pane. Idempotent on matching `id`. |
| `closeTab(tabId)` | Remove tab, activate a neighbor if the removed tab was active. |
| `activateTab(tabId)` | Set active tab. No-op if unknown. |
| `renameTab(tabId, title)` | Update (or clear) title override. |
| `moveTab(tabId, toIndex)` | Clamp + reorder. |
| `splitPane(tabId, targetId, edge, pane, ratio?)` | Insert new leaf along `edge` of target; activates new pane. |
| `closePane(tabId, paneId)` | Collapse parent split; removes tab when last pane closes. |
| `focusPane(tabId, paneId)` | Set active pane. |
| `updatePaneData(tabId, paneId, updater)` | Replace `pane.data` via updater. |
| `renamePane(tabId, paneId, title)` | Update (or clear) pane title override. |
| `setSplitRatio(tabId, path, ratio)` | Clamp 0.1..0.9 and write. |
| `hydrate(next)` | Replace full state from persisted snapshot. |
| `reset()` | Clear everything. |
| `focusNeighbor(direction)` | Move focus spatially; returns new pane id or null. |

## Public API exports

```ts
import {
  Workspace,           // React component
  createWorkspaceStore,
  selectWorkspaceSnapshot,
  findActiveTab,
  getSpatialNeighborStackId,
  classifyBodyDrop,
  useWorkspaceActions,
  useWorkspaceSelector,
  type PaneRegistry,
  type PaneDefinition,
  type PaneRenderer,
  type PaneRendererProps,
  type WorkspaceProps,
  type WorkspaceState,
  type WorkspaceStore,
  type Pane,
  type Tab,
  type LayoutNode,
  type BodyDrop,
} from '@tinker/panes';

import '@tinker/panes/styles.css';
```

**Internalized** `[2026-04-20]`: `findLayoutRoot`, `findTabContainingPane`,
`findStackPath`, `nodeAtPath` — zero external callers. Promoted
`classifyBodyDrop` + `BodyDrop` from private `Stack.tsx` helper to public
tested `layout.ts` export.

Stylesheet consumes `@tinker/design` CSS variables only. Never hex.

## Persistence contract

Hosting app stores `selectWorkspaceSnapshot(store.getState())` verbatim. Hydration replays `actions.hydrate(snapshot)`. Schema versioned via `WorkspaceState.version = 1`. Future migrations bump version and adapt in userland.

## Migration plan (Dockview → panes)

Parallel-agent work order, one PR per bullet:

1. **Chat pane** — move its Dockview wiring out; register `{ kind: 'chat' }` with `PaneRegistry`. Multi-chat via additional tabs, no `chat-panels.ts` hack needed.
2. **Today pane** — register `{ kind: 'today' }`.
3. **Scheduler pane** — register `{ kind: 'scheduler' }`.
4. **Settings pane** — register `{ kind: 'settings' }`.
5. **Playbook pane** — register `{ kind: 'playbook' }`; drop its `params` hack.
6. **VaultBrowser pane** — register `{ kind: 'vault-browser' }`.
7. **File renderers** (CodeRenderer, CsvRenderer, HtmlRenderer, ImageRenderer, MarkdownEditor, MarkdownRenderer) — each registers a kind; `file-open.ts` maps file extension → `pane.kind`.
8. **Retire Dockview** — remove `dockview-react` dep; replace `LayoutState.dockviewModel` in `@tinker/shared-types` with `WorkspaceState`; add a one-shot migration reading old snapshots and dropping them (layout is re-populatable from defaults).

Each migration lands behind no feature flag — the pane just moves. The old `Workspace.tsx` keeps working until the last pane migrates, at which point `Workspace.tsx` is replaced with `<WorkspaceV2 store={...} registry={...} />`.

## Testing discipline

- `src/core/utils/layout.test.ts` — pure tree ops (21 tests).
- `src/core/store/store.test.ts` — store actions + invariants (12 tests).
- `src/react/components/Workspace.test.tsx` — React Testing Library (8 tests).
- `apps/desktop/src/renderer/routes/panes-demo.tsx` — interactive demo at `?route=panes-demo` for manual + Playwright E2E.

CI gate: `pnpm --filter @tinker/panes typecheck && pnpm --filter @tinker/panes test` must stay green.

## Follow-ups (new tasks)

- `@tinker/panes` — drag-to-dock between panes inside the same tab (type plumbed; demo wires a naive impl).
- Workspace-level split (cmux-style sidebar + tabs area) — implement once [[13-workspace-sidebar]] lands.
- Pane maximize/minimize action — ship when first pane asks for it.
- Pane keyboard shortcut routing + focus intents — pairs with [[12-attention-coordinator]].
