---
type: session
date: 2026-04-22
topic: TIN-190 workspace shell port (sidebar + titlebar + Paper 9I-0 parity)
linear: TIN-190
branch: khvni/tin-190
base: origin/main @ 9c264c6
---

# Session — TIN-190 workspace shell port

## What shipped

- **Reference doc** `agent-knowledge/reference/anomalyco-opencode-desktop-layout.md` — anomalyco is SolidJS, real layout lives in `packages/app` not `packages/desktop`. Architectural patterns copied (titlebar + sidebar rail + resizable content + tokens-driven theme) without porting Solid code. Explicit divergences catalogued (no project hierarchy, no tabs-within-panes, no command palette).
- **Execution spec** `agent-knowledge/specs/2026-04-22-workspace-layout-port-design.md` — files to create/modify/delete, build sequence, acceptance gates, risks, dropped keyboard shortcuts (with reasons), 7 concrete follow-ups catalogued.
- **Code** — new `WorkspaceShell` grid wrapper (folder-per-component per D21): `.tsx` + `.css` + `.test.tsx` + `index.ts`. Mounted in `Workspace.tsx` with `WorkspaceSidebar` rail passed into the `sidebar` slot; previous `<main className="tinker-workspace-shell">` ad-hoc layout retired in favour of the dedicated shell.
- **styles.css cleanup** — dropped the obsolete `.tinker-workspace-shell` grid rule; `WorkspaceShell.css` owns it now. The class stays in the 100%-height reset chain intentionally (follow-up §6 nit from Reviewer).

## Verifier run (local)

- `pnpm -r typecheck` → green (9 packages).
- `pnpm -r lint` → green (10 packages).
- `pnpm -r test` → 48 test files, 227 tests passing (includes new `WorkspaceShell.test.tsx`, 2 tests).
- `grep -rn 'dockview-react' apps/ packages/` → no hits.
- Paper screenshot of `9I-0 Tinker Workspace — Light` attached to PR body for human visual diff.

## Reviewer outcome (Elon 5-step + Buchan Glass + CLAUDE.md §5)

"Ship-after-fixes" → no blockers. Only non-blocking nits:

1. `Workspace.tsx:467` — `userInitial` derivation could live in `WorkspaceSidebar` when a future ticket passes `currentUserId` as a prop; defer.
2. `Workspace.tsx:478` — `onOpenAccount={openSettingsPane}` is a spec-sanctioned MVP stub per §6.6; dedicated account route is a post-MVP follow-up.
3. `styles.css:18` — `.tinker-workspace-shell` in the reset chain is now redundant since the shell component sets its own height/width. Micro-cleanup; defer unless a future PR touches `styles.css`.

All three land as follow-up TINs if/when they become blocking. None gate this PR.

## Scope firewall applied

Spec non-goals honored:
- no command-palette / shortcut registry port
- no project/workspace/session hierarchy in the rail (Tinker has no project concept)
- no per-session tab strip (`session-side-panel.tsx` not ported)
- no sidebar attention badges (TIN-148 deferred)
- no Tauri `setTheme` bridge
- no mobile drawer variant (desktop-only)

Follow-ups catalogued in `agent-knowledge/specs/2026-04-22-workspace-layout-port-design.md` §6 (7 items).

## Deferred from Paper 9I-0

The Paper artboard shows per-pane `LeftTabBar` / `RightTabBar` sub-tabs. Ticket acceptance explicitly excludes "tabs-within-panes" for MVP — each pane renders exactly one `TinkerPaneData` kind via `PaneRegistry`. The Paper sub-tabs therefore render as zero visual change in code; their presence in Paper is a post-MVP design hint.

## What's NOT in this PR (but the next engineer should know)

- The rail's deferred items (Explorer / Skills / Agents / Connections / Playbook / Analytics) render disabled to match Paper. When their backing pane kinds ship post-MVP per D25, enable the item + bind to the open-pane handler.
- `userInitial` derivation is a single character uppercase of `currentUserId` with a `'T'` fallback. Once TIN-84 exposes the current user's display name / avatar to Workspace, swap in the proper initial.

## Ship checklist

- [x] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` green on branch.
- [x] No `dockview-react` imports.
- [x] Reference doc + spec doc checked in.
- [x] Reviewer pass (ship-after-fixes, zero blockers).
- [x] tasks.md row flipped to `review` with PR link.
- [x] Linear TIN-190 → In Review + PR attached.
- [ ] PR body screenshot vs Paper `9I-0` (light + dark).
