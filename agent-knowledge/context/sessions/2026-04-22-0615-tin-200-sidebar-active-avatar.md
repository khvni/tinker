---
type: session
date: 2026-04-22
topic: TIN-200 sidebar active-state + provider avatar
---

# Session — TIN-200 sidebar active-state + provider avatar

## Context

One-ticket PR against `main` following the dispatch pattern in
`2026-04-22-workspace-ui-push.md`. Branch `khvni/sidebar-active-avatar`.
Ticket was Size S in Linear, M1 MVP scope.

## What changed

Two sidebar polish bugs closed:

1. `WorkspaceSidebar` used to hardcode `isActive` on the `Workspaces` rail
   item. Now accepts a `activeRailItem: TinkerPaneKind | null` prop and
   lights up the rail item whose `TinkerPaneKind` matches the focused
   pane (`chat` → Chats, `memory` → Memory, `settings` → Settings).
   `Workspace.tsx` derives the prop through `useWorkspaceSelector` from
   `@tinker/panes` so the rail re-renders when the user clicks around.
2. Avatar no longer hardcodes the first letter of the user id. Props now
   carry `avatarUrl: string | null` + `accountLabel: string`. When the
   URL is present, an `<img>` renders inside the existing `.__avatar`
   26×26 container (so img + initial share sizing). On load error, state
   flips to initial fallback; a `useEffect` keyed on `avatarUrl` resets
   the error flag when the prop changes so a new user's photo gets a
   fresh chance to load.

Tooltips landed on every rail item (native `title` attribute), plus on
the account button using the computed `accountLabel` string
(`"Account · Guest"` for guest, `"Account · <email ?? displayName>"`
otherwise). `aria-current="page"` is the active-state source of truth
for both styling (existing CSS rule) and accessibility.

## Files touched

- `apps/desktop/src/renderer/workspace/components/WorkspaceSidebar/WorkspaceSidebar.tsx`
- `apps/desktop/src/renderer/workspace/components/WorkspaceSidebar/WorkspaceSidebar.css`
- `apps/desktop/src/renderer/workspace/components/WorkspaceSidebar/WorkspaceSidebar.test.tsx`
- `apps/desktop/src/renderer/workspace/Workspace.tsx`
- `agent-knowledge/context/tasks.md` (row 1.13 added)

## Review notes

- Paper 9I-0 / 9Y-0 / A0-0 / BD-0 confirmed via Paper MCP. Active style
  (amber-soft fill via `var(--color-accent-soft)`) already matched Paper
  `#F9C04138` before this change — no CSS retokenization needed.
- Avatar size kept at Paper BE-0 26×26 (ticket body estimated 28 based
  on 4px padding math; Paper screenshot shows 26, in-code was already
  26, kept at 26).
- Initial version of the executor's tsx wrote the `<img>` as a sibling
  replacement of the `.__avatar` span. That made the img 36×36 (filling
  `.__avatar-shell`) while the initial fallback stayed 26×26.
  Corrected during reviewer pass by wrapping both states inside the
  single `.__avatar` 26×26 container.
- `alt=""` on the `<img>`: outer button already carries
  `aria-label="Account"` + `title={accountLabel}`; a verbose alt would
  double-announce on screen readers. Inner span flips `aria-hidden`
  based on whether the img or the initial is showing.

## Verification

- `pnpm -r typecheck` green across 10 packages.
- `pnpm -r lint` green across 10 packages.
- `pnpm -r test` green — desktop renderer 236 tests / 49 files pass,
  10 of which are the new+updated `WorkspaceSidebar.test.tsx` tests.
- No Rust touched — `cargo test --lib` skipped.

## PR + Linear

- Branch: `khvni/sidebar-active-avatar` (cleaned from the auto-generated
  `khvni/tin-200` placeholder).
- PR: opened as draft + flipped to ready via `gh pr ready`.
- Linear TIN-200: Backlog → In Progress → In Review + PR link attached
  via comment.
- `tasks.md` row 1.13 status: `review`.
