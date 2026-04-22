---
type: session
date: 2026-04-22
topic: Titlebar toggles, Paper 9J-0 token flip, rail cleanup (TIN-193, TIN-194, TIN-195)
---

# Session — TIN-193 + TIN-194 + TIN-195

## PR

- **PR #118** — `feat(m1): titlebar toggles, Paper 9J-0 tokens, rail cleanup (TIN-193, TIN-194, TIN-195)`
- Branch: `khvni/tin-193-195`

## What changed

### TIN-193 — Titlebar toggles + WorkspacePreferences + keybinds

- `packages/shared-types/src/layout.ts`: `WorkspacePreferences` gained `isLeftRailVisible: boolean` and `isRightInspectorVisible: boolean`. Default: left=true, right=false.
- `Titlebar.tsx`: Replaced 3 icon buttons (Plus/Book/Settings) with 2 Paper 9Q-0 SVG toggles (`LeftPaneToggleIcon`, `RightPaneToggleIcon`). Props now: `isLeftRailVisible`, `isRightInspectorVisible`, `onToggleLeftRail`, `onToggleRightInspector`. Dropped `onNewSession`/`onOpenMemory`/`onOpenSettings`.
- `Titlebar.css`: Actions cluster is 68px flex, 10px gap, end-aligned. Stroke uses `currentColor` so `aria-pressed` drives fill state.
- `WorkspaceShell.tsx` + `.css`: Added `inspector?: ReactNode` slot and `isLeftRailVisible`/`isRightInspectorVisible` props. Switched from conditional rendering to collapse-to-0 CSS with `width` transition (`var(--duration-base)`). Sidebar collapses to `width: 0`; inspector collapses to `width: 0`.
- `Workspace.tsx`: Wires keyboard shortcuts (`⌘B` / `⌘⌥B`, skips editable targets). `toggleLeftRail`/`toggleRightInspector` mutate preferences via `handleWorkspacePreferencesChange`. Layout save debounce persists preferences.
- `WorkspaceShell.test.tsx`: Added tests for inspector slot, sidebar collapse, inspector collapse.
- `Titlebar.test.tsx`: Already updated by prior agent; added `aria-pressed` assertions.

### TIN-194 — Paper 9J-0 light token flip

- `packages/design/src/styles/tokens.css`:
  - `--color-bg-primary`: `#f4f3f2` → `#fefcf8`
  - `--color-bg-elevated`: `#fefcf8` → `#ffffff`
  - `--color-bg-panel`: `#ebe9e6` → `#f9f5ec`
  - `--color-bg-hover`: `#ecebe9` → `#f4efe4`
  - `--color-bg-input`: kept `#fefcf8` (per audit §5 recommendation; overrides the `#ffffff` that a prior agent had written)
  - Deleted stale "D23 layer reversal" comment.
- `apps/desktop/src/renderer/routes/design-system.tsx`: Updated `SURFACE_SWATCHES` hex labels to match new tokens.
- `agent-knowledge/product/decisions.md`: Appended D28 — "Light tokens follow Paper 9J-0 exactly" (supersedes D23 direction). Notes `bg-input: #fefcf8` per audit §5.

### TIN-195 — Rail cleanup + onOpenConnections + SettingsShell scrollTargetSectionId

- `WorkspaceSidebar.tsx`: Removed Explorer, Skills, Agents, Playbook, Analytics rail items. Dropped Workspaces `isActive`. Kept: Chats, Connections, Memory, New tab, Settings, Account avatar. Added `onOpenConnections` prop.
- `WorkspaceSidebar.test.tsx`: Updated to test only MVP nav labels, removed `showPlaybookBadge`, added `onOpenConnections` callback test.
- `WorkspaceSidebar.css`: Cleaned up unused dot/badge styles.
- `WorkspaceSidebar/icons.tsx`: Removed unused icons (Workspaces, Explorer, Skills, Agents, Playbook, Analytics, NewTab). Kept Chats, Connections, Memory, Settings, LeftPaneIcon, RightPaneIcon.
- `SettingsShell.tsx`: Added `scrollTargetSectionId?: string | undefined` prop. Uses `useEffect` to call `handleSelect(scrollTargetSectionId)` when it points to a valid section, so both controlled and uncontrolled usage react to one-shot navigation hints.
- `SettingsShell.test.tsx`: Added test for `scrollTargetSectionId` overriding `defaultActiveSectionId`.
- `SettingsPane.tsx`: Passes `runtime.pendingSectionId ?? undefined` as `scrollTargetSectionId` to `SettingsShell`. Keeps existing `useEffect` consumption pattern for runtime `pendingSectionId` so the hint is cleared exactly once.
- `settings-pane-runtime.ts`: Added `pendingSectionId: string | null` and `onPendingSectionConsumed(): void` to `SettingsPaneRuntime`.
- `Workspace.tsx`: `openConnectionsSection` sets `pendingSettingsSectionId` to `'connections'` then opens/focuses settings pane. `openSettingsPane` clears the pending id.

### Supporting fixes

- `packages/memory/src/layout-store.ts`: `normalizePreferences` now reads `isLeftRailVisible` and `isRightInspectorVisible` from stored JSON, falling back to defaults.
- `packages/memory/src/layout-store.test.ts`: Updated assertions to include full `WorkspacePreferences` shape.
- `MemorySettingsPanel.tsx`: Preference toggle now spreads `...workspacePreferences` before overriding `autoOpenAgentWrittenFiles`, preventing partial-object TypeScript errors.
- `MemorySettingsPanel.test.tsx`: Uses `createDefaultWorkspacePreferences()` spread for the off-state test.
- `register-pane-renderers.test.tsx` + `SettingsPane.test.tsx`: Added missing `pendingSectionId` and `onPendingSectionConsumed` to runtime stubs.

## Verification

- `pnpm -r typecheck` green
- `pnpm -r lint` green
- `pnpm -r test` green (232 desktop tests, 110 memory tests, 71 panes tests, 85 design tests, etc.)

## Caveats / follow-ups

- Right inspector is no-op in MVP: the `inspector` slot exists in `WorkspaceShell` but nothing is passed to it from `Workspace.tsx`. The toggle state + keybind are wired and persisted, so the inspector pane can slot in later without changing preferences schema.
- `SettingsPane` uses both its local `useEffect` to consume `pendingSectionId` AND passes it to `SettingsShell` as `scrollTargetSectionId`. This is redundant but safe; a future refactor could remove the local effect and let SettingsShell own the reaction entirely.
