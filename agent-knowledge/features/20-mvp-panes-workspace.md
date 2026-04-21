---
type: feature
status: in progress
priority: p0
pillar: M1
depends_on: ["@tinker/panes scaffold (done)", "@tinker/design primitives (done)"]
supersedes: ["07-workspace-persistence", "10-tinker-panes (partial)"]
mvp: true
---

# M1 — Panes + tabs workspace

## Goal

Provide a cohesive tabbed, pane-based workspace that renders via `@tinker/panes` — the only sanctioned layout engine (per [[decisions]] D16). MVP default layout is a single Chat pane; split support and additional pane kinds (file, settings, memory) are registered but not exercised by the default layout.

## Scope

- `@tinker/panes` renders the workspace shell.
- `PaneRegistry<TinkerPaneKind>` is the only entry point for adding pane types. The union covers four kinds: `chat | file | settings | memory`.
- Layout snapshots serialize as `WorkspaceState<TinkerPaneData>` and persist in SQLite (`layouts` table via `@tinker/memory/layout-store`).
- `dockview-react` is removed from the repo as part of M1.9.
- Pre-existing panes not in MVP (`Today`, `SchedulerPane`, `Playbook`, `VaultBrowser`) are retired during M3.11 — either deleted or moved to `apps/desktop/_deferred/`.

## Out of scope

- Multi-workspace UI / workspace sidebar ([[13-workspace-sidebar]] — deferred).
- Attention rings / unread indicators ([[12-attention-coordinator]] — deferred).
- Split-pane default layout. MVP opens one pane; user splits via `@tinker/panes` API if they want.
- Tab drag reordering across pane groups (already supported by `@tinker/panes`; MVP default layout has only one group).

## Acceptance

- First-run → workspace shows a single Chat pane.
- `pnpm --filter @tinker/panes test` green (69+ tests).
- No `dockview-react` imports in any file (`grep -r "dockview" --include="*.ts" --include="*.tsx" apps packages` returns only docs/history).
- Layout state restores across app relaunches.
- Adding a fifth pane kind = registering one entry in `pane-registry.ts`. No other files change.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M1.

## Notes for agents

- `PaneRegistry` is generic over `TinkerPaneKind`. Don't widen it to `string` — the discriminated union is load-bearing for type-safe pane payloads.
- `WorkspaceState<TData>` is typed in `@tinker/panes/types.ts`. Import from `@tinker/shared-types` once it re-exports for cross-package consumers.
- Existing `@tinker/memory/layout-store` already reads/writes `WorkspaceState` shapes. Don't reimplement.
- Dockview retirement (M1.8–1.9) is the last Dockview PR. Reference D16 in the commit message.
