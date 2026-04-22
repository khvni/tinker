---
type: session
date: 2026-04-22
topic: TIN-101 + TIN-151 — Paper 9I-0 workspace shell (sidebar rail + titlebar)
tickets: [TIN-101, TIN-151]
branch: khvni/tin-101-151
---

# Session — sidebar rail + titlebar shell composition

## Outcome

PR `feat(workspace): sidebar + titlebar shell (TIN-101, TIN-151)` opened as draft, tests green (`pnpm -r typecheck && pnpm -r test && pnpm -r lint` all pass), Paper 9I-0 mapped 1:1 on structure. TIN-101 + TIN-151 moved from `Backlog` → `In Progress` → `In Review` (PR link attached in Linear on `pr ready`).

## Why this shape

The dispatch promoted TIN-101 / TIN-151 from post-MVP to MVP on 2026-04-22 with the instruction that "Paper MCP = source of truth for UI." Paper artboard `9I-0` ("Tinker Workspace — Light") shows a three-surface shell:

- **TitleBar** — 36px, panel-bg, traffic lights (68px) + centered "Tinker" wordmark + two window-action icons (68px)
- **LeftRail** — 52px, panel-bg, icon nav with 11 rail items split between RailTop (Workspaces active / Explorer / Chats / Skills / Agents / Connections / Memory / divider / NewTab) and RailBottom (Playbook / Analytics / Settings / Avatar)
- **ContentArea** — the existing `<PanesWorkspace>` fills the remaining flex row

That is **not** the card-based sidebar described in `agent-knowledge/features/13-workspace-sidebar.md` — that spec predates Paper and predates D25. Paper wins per the dispatch. The existing `packages/workspace-sidebar` (TIN-149 / PR #45, card-based) stays unwired post-MVP; it's dead code per D25 short-term.

## What shipped

- `apps/desktop/src/renderer/workspace/components/WorkspaceSidebar/` — `WorkspaceSidebar.tsx`, `WorkspaceSidebar.css`, `WorkspaceSidebar.test.tsx`, `icons.tsx`, `index.ts`. RailItem helper + 11 buttons. Wired: Workspaces (active anchor), Chats, Memory, Settings, Account, New tab. Disabled placeholders (visually rendered, `disabled` attribute): Explorer, Skills, Agents, Connections, Playbook, Analytics.
- `apps/desktop/src/renderer/workspace/components/Titlebar/` — `Titlebar.tsx`, `Titlebar.css`, `Titlebar.test.tsx`, `index.ts`. 36px bar with 68px traffic-light spacer + centered title + two disabled panel-toggle stubs. `data-tauri-drag-region` for window drag.
- `apps/desktop/src/renderer/workspace/Workspace.tsx` — shell rewrite. Removed old `<header>` + badges + compact `IntegrationsStrip`. New composition: flex column `Titlebar + (LeftRail + ContentArea)`.
- `apps/desktop/src/renderer/styles.css` — replaced `.tinker-workspace-shell` grid-3 with flex-column + row; deleted `.tinker-header`, `.tinker-header-meta`, `.tinker-workspace-integrations` + the matching media-query block.
- `apps/desktop/src/renderer/routes/design-system.tsx` — new "Shell" playground tab composing Titlebar + WorkspaceSidebar for visual regression.
- `apps/desktop/src-tauri/tauri.conf.json` — `titleBarStyle: "Overlay"` + `hiddenTitle: true` on the main window (macOS-only; ignored on Win/Linux — see follow-ups).

## What got trimmed during review (Elon step 2: DELETE)

- Dead `mcpStatus` prop on `WorkspaceProps` + the matching `App.tsx` call site — the old `IntegrationsStrip` was the only consumer and it's gone from the shell.
- `IconProps.stroke` parameter soup on every rail icon. Zero callers used it; hardcoded the three token defaults (`INK` / `MUTED` / `ACTIVE`) at the top of `icons.tsx`.
- `RailItem`'s `badge?` prop. Only the Playbook slot needed it. Replaced with a plain child node on that one caller.

## Decisions deferred via follow-ups

1. **Shell geometry tokens.** `WorkspaceSidebar.css` + `Titlebar.css` hardcode `52px` / `36px` / `68px` / etc. Per D14 + Buchan Glass, sizes should resolve from tokens. New tokens belong in `packages/design` (separate PR). Ship follow-up: `feat(design): shell geometry tokens (--size-sidebar-rail, --size-titlebar, --size-rail-item)`.
2. **Cross-platform titlebar.** `titleBarStyle: "Overlay"` is macOS-only. Win/Linux still render native chrome above our custom Titlebar → double-bar. Acceptable for MVP (PRD is macOS-first); file follow-up for platform-conditional shell when Win/Linux land.
3. **Titlebar window-action wiring.** Left/right panel toggles render as `disabled` stubs. Follow-up wires them to `PaneRegistry` visibility state once split-view surfaces become real UX.
4. **Icons promotion.** `icons.tsx` co-located under `WorkspaceSidebar/`. Promote to `@tinker/design` when a second caller appears (YAGNI today).
5. **Paper light-mode token drift.** `--color-bg-panel` in `tokens.css` is `#ebe9e6` (cool grey) but Paper shows `#F9F5EC` (warm cream). Known drift per TIN-176 audit. The shell correctly resolves via the token, so fixing the token resolves the shell automatically. Not fixed here — separate PR per D14.

## Test coverage added

- `WorkspaceSidebar.test.tsx` — 4 tests: static markup renders nav + active state + initial; deferred items render as `disabled`; playbook badge shows/hides; click callbacks fire for wired items (jsdom + `react-dom/client` `createRoot` + `act`).
- `Titlebar.test.tsx` — 2 tests: drag region + traffic-light spacer + labels; dynamic title slot.

## Verification

- `pnpm -r typecheck` — clean
- `pnpm -r test` — 181/181 pass (40 test files, including 6 new)
- `pnpm -r lint` — clean
- `cargo test --lib` — pre-existing unrelated build failure on the `binaries/opencode-aarch64-apple-darwin` external binary resource path. Not a regression from this PR. Tauri config JSON validates; `titleBarStyle` + `hiddenTitle` conform to Tauri v2 schema.
- Paper visual match: structure 1:1 (dimensions, ordering, active-state amber, avatar pill, divider, traffic-light reserve). Surface colors resolve via `--color-bg-panel` token; warm-cream match lands once TIN-176 token fix ships.

## Next dispatch hook

Row γ of the 2026-04-22-workspace-ui-push dispatch table is now shipped. Remaining UI rows in that table can proceed in parallel (α=TIN-187, β=TIN-182, δ=TIN-84, ε=TIN-70/71/175, ζ=TIN-146/147, η=TIN-61-call-site-migration). The shell is stable enough that all those rows can land independently now.
