---
type: reference
tags: [panes, layout, heritage, cmux, superset, opencode]
---

# `@tinker/panes` — heritage + architectural synthesis

> Why the layout engine ended up looking the way it does, and what inspired each part.

Three open-source projects informed `@tinker/panes`. None of their code lives in our repo — we studied the types, read the heuristics, and wrote a clean-room implementation. This file preserves attribution and the decisions that came out of the study.

## The three sources

### 1. `anomalyco/opencode` — `packages/desktop` + `packages/app`

- Stack: Tauri v2 + **Solid.js** + Kobalte + TanStack Solid Query.
- Layout: not recursive — a fixed shell (sidebar + chat + review + terminal + side-panel) composed via CSS grid + `ResizeHandle`. Tabs only for file buffers inside the review area.
- Takeaways:
  - **Platform interface** in `desktop/src/index.tsx` — abstract OS concerns behind a typed `Platform` contract.
  - **Rust sidecar handshake** via `Channel<InitStep>` beats polling — use for our host-service spawn.
  - **`ConnectionGate`** — blocking→background health check, 10s timeout, retry-every-1s. Port to [[15-connection-gate]].
  - **Session history windowing** — bounded paint + batch reveal. Port to [[14-session-history-windowing]].
- Non-portable: every `.tsx` is Solid JSX; Kobalte, solid-dnd, solid-primitives all Solid-only.

### 2. `manaflow-ai/cmux`

- Stack: native macOS Swift / AppKit / SwiftUI + **Bonsplit** (their vendored split-pane library) + libghostty.
- Layout: **recursive binary split tree** (node = split orientation + two children + ratio; leaf = panel). `PanelType = terminal | browser | markdown`. Vertical workspace sidebar with rich metadata cards.
- Takeaways:
  - **Recursive binary split tree** is the right core data structure for Tinker workspaces.
  - **Workspace sidebar** (vertical, not top tabs) → [[13-workspace-sidebar]].
  - **Panel type polymorphism** + per-panel focus intents.
  - **`WorkspaceAttentionCoordinator`** (rings / flashes / unread, focus-aware) → [[12-attention-coordinator]].
  - **Auto-reorder workspace cards** on notification arrival.
- Non-portable: everything is AppKit/NSView; no browser runtime analog. Implementation is pure inspiration.

### 3. `superset-sh/superset` — `packages/panes`

- Stack: Bun + Electron + React 19 + TailwindCSS + shadcn/ui + zustand + react-dnd.
- Layout: **exact type model Tinker needs** — `LayoutNode = leaf | split`, `Tab<TData>`, `WorkspaceState<TData>`. Generic over per-pane payload. `PaneRegistry` keyed by `pane.kind`. Spatial navigation via `getSpatialNeighborPaneId`.
- Takeaways:
  - Type shape (`LayoutNode`, `Tab`, `Pane`, `WorkspaceState`, `PaneRegistry`) is the right level of abstraction.
  - Host/device split (`packages/host-service` + Electron coordinator) → [[11-host-service]].
  - `ask_user` overlay pattern (agent clarifications are interactive, not plain text) → [[D20]].
  - Co-located folder convention → [[D21]].
- License: Elastic License 2.0. We did not copy code. We replicated API shape and rewrote the implementation to keep our MIT license clean.

## What Tinker's `@tinker/panes` does differently

- **HTML5 drag-and-drop**, not react-dnd. Cuts a dep; adequate for tab reorder + edge dock.
- **Zustand vanilla** + `useSyncExternalStore` instead of zustand/react, so consumers can subscribe outside React if they want.
- **`ratio` clamped to 0.1..0.9** — Superset uses a `splitPercentage?: number` with no documented bounds; we chose a bound to prevent panes collapsing to 0.
- **Design tokens only** — all CSS reads `@tinker/design` CSS variables. No Tailwind, no hex.
- **`exactOptionalPropertyTypes` compliant** — all optional fields either omitted or present, never `: string | undefined`. Tighter types than the inspirations' TS strict mode.
- **Path representation** — `SplitPath = ReadonlyArray<'a' | 'b'>` (not Superset's `SplitBranch[]` with `'first' | 'second'`). Shorter, easier to read in logs.

## What we deliberately did NOT port

- Floating / undocked windows.
- Cross-group tab merging (tabs inside splits).
- Dockview's persistence format.
- Kobalte / Radix popovers inside panes (left to app layer).
- Solid-style reactivity — we stay in React 19.

## Refresher — where each pattern landed in Tinker

| Pattern | Origin | Lands in |
|---|---|---|
| Recursive split-tree + `Tab<TData>` + `PaneRegistry` | Superset | [[10-tinker-panes]] |
| `getSpatialNeighborPaneId` spatial focus | Superset | `@tinker/panes` core/utils |
| `ResizeHandle` keyboard + pointer events | OpenCode + clean-room | `@tinker/panes` react/components |
| Vertical workspace sidebar w/ metadata cards | cmux | [[13-workspace-sidebar]] |
| Attention rings + flash decisions | cmux | [[12-attention-coordinator]] |
| Host/device split + coordinator pattern | Superset | [[11-host-service]] + [[D17]] |
| Platform interface + sidecar handshake | OpenCode | [[11-host-service]] + Rust coordinator |
| Session history windowing | OpenCode | [[14-session-history-windowing]] |
| Connection gate splash + retry | OpenCode | [[15-connection-gate]] |
| `ask_user` overlay | Superset | [[D20]] |
| Co-located folder convention | Superset | [[D21]] |

## Pointers

- `packages/panes/src/` — our implementation
- Superset panes type model: `github.com/superset-sh/superset` @main `packages/panes/src/types.ts`
- cmux attention: `github.com/manaflow-ai/cmux` @main `Sources/Panels/Panel.swift`
- OpenCode gate + windowing: `github.com/anomalyco/opencode` @dev `packages/app/src/app.tsx` + `packages/app/src/pages/session.tsx`
