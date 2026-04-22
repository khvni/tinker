---
type: spec
tags: [workspace, layout, shell, sidebar, titlebar, m1, mvp]
linear: TIN-190
status: ready
created: '2026-04-22'
author: claude-code
depends_on:
  - agent-knowledge/reference/anomalyco-opencode-desktop-layout.md
  - agent-knowledge/reference/paper-design-audit.md
  - agent-knowledge/product/decisions.md (D14, D16, D21, D23, D25, D26)
---

# Spec — Workspace layout port (TIN-190)

Mount the already-built `WorkspaceSidebar` next to the panes surface so the Tinker workspace matches Paper artboard `9I-0 Tinker Workspace — Light` and the architectural shape of anomalyco/opencode's desktop layout (titlebar + sidebar rail + resizable content). This spec defers every anomalyco pattern that requires a command registry, route encoding, or session tab strip — those are called out explicitly in §6 (Follow-ups).

Pillar: **M1 — Panes+tabs workspace**. MVP scope per [[D25]].

## 1. Goals

1. Render Tinker's left sidebar rail so the workspace matches the Paper artboard 1:1 in both dark and light themes.
2. Keep `@tinker/panes` as the single layout engine (per [[D16]]) — sidebar + titlebar are plain React, everything inside the content frame continues to be the recursive split tree.
3. Preserve every primitive + pane + runtime already wired into `Workspace.tsx` (chat runtime, memory runtime, settings runtime, file runtime, attention store, layout persistence).
4. Enforce one-pane-per-tab: each pane renders exactly one kind (chat / file / settings / memory). No in-pane tab switcher.
5. Ship without adding a new dependency, new pane kind, or new primitive.

## 2. Non-goals (explicit, with why)

- Command palette + keyboard shortcut registry — anomalyco's `CommandProvider` is a separate concern and MVP has no palette surface. Follow-up (§6.3).
- Project/workspace/session hierarchy in the sidebar — Tinker has no "project" concept (D25/D26). Sidebar rail stays flat.
- Per-session tab strip inside a pane — anomalyco ships `session-side-panel.tsx` with `Tabs`; Tinker uses panes-only multiplicity.
- Sidebar attention badges (`attention.signal` → sidebar-card dot) — tracked separately as TIN-148 (post-MVP).
- Tauri `setTheme` bridge or OS theme listener — tokens already cover dual-theme (D23); no runtime bridging needed for MVP.
- Mobile drawer variant of the sidebar — Tinker is desktop-only.
- Route encoding, deep links, base64 dir slugs.

## 3. Files to create

| Path | Purpose |
|---|---|
| `agent-knowledge/reference/anomalyco-opencode-desktop-layout.md` | Reference + citations (**already created**). |
| `agent-knowledge/specs/2026-04-22-workspace-layout-port-design.md` | This spec. |
| `apps/desktop/src/renderer/workspace/components/WorkspaceShell/WorkspaceShell.tsx` | Grid wrapper: Titlebar on top, sidebar + panes in the content row. |
| `apps/desktop/src/renderer/workspace/components/WorkspaceShell/WorkspaceShell.css` | Shell grid styling (titlebar row + sidebar+content row). |
| `apps/desktop/src/renderer/workspace/components/WorkspaceShell/WorkspaceShell.test.tsx` | Render smoke test verifying shell slots (titlebar, sidebar, content). |
| `apps/desktop/src/renderer/workspace/components/WorkspaceShell/index.ts` | Barrel export. |

The shell component follows the D21 folder-per-component convention.

## 4. Files to modify

| Path | Change |
|---|---|
| `apps/desktop/src/renderer/workspace/Workspace.tsx` | Replace the `<main className="tinker-workspace-shell">` + two-child layout with `<WorkspaceShell titlebar={...} sidebar={...}><PanesWorkspace /></WorkspaceShell>`. Derive `userInitial` from `currentUserId`. Wire `onOpenAccount` → reuses `openSettingsPane` (MVP account is surfaced inside Settings via TIN-84; dedicated Account route is post-MVP). |
| `apps/desktop/src/renderer/styles.css` | Delete the `.tinker-workspace-shell` rule (supersede by `WorkspaceShell.css`). Keep the root `tinker-workspace-shell` class on the html/body reset rule for 100% height. |
| `apps/desktop/src/renderer/workspace/components/WorkspaceSidebar/WorkspaceSidebar.css` | Ensure the rail stretches to full shell height (confirm `flex-shrink: 0` already holds — no change expected, gated on visual check). |

## 5. Files to delete

None for this pass. The follow-up in §6 may prune `tinker-workspace-shell` in `styles.css` after the shell component owns it. Keep it here as a single-line reset target (`.tinker-workspace-shell { height: 100%; margin: 0; }`) since `html/body` already cascades through it — no deletion needed.

## 6. Follow-ups (explicit scope-creep firewall)

Each item below is a separate PR / Linear ticket. The MVP acceptance checklist for TIN-190 does **not** include any of these.

| # | Spin-off | Rationale |
|---|---|---|
| 6.1 | Sidebar-card attention badges (TIN-148 already on file) | Post-MVP visual. Depends on `@tinker/attention` store + a sidebar-card subscribing component. |
| 6.2 | Wire the remaining rail items (Explorer / Skills / Agents / Connections / Playbook / Analytics) | D25 deferrals. When the corresponding pane/kind ships, enable the rail item and bind it to the open-pane handler. |
| 6.3 | Shortcut registry (anomalyco's `CommandProvider` equivalent) | File the ticket only if MVP ships and shortcuts become a real user request. Anomalyco's concrete bindings are catalogued in the reference doc §3. |
| 6.4 | Sidebar collapse toggle + `mod+b` | Paper artboard shows an always-on sidebar. Add when Paper or the user actually asks for hide-sidebar. |
| 6.5 | Sidebar-aware session deep-linking | No Tinker URL routing yet. |
| 6.6 | Dedicated Account pane (separate from Settings) | Ship only if TIN-84 surfaces more than the single row. |
| 6.7 | Titlebar new-session glyph redundancy cleanup | The titlebar currently exposes a "+" new-chat button. Sidebar now also has a "New tab" rail item wired to the same handler. Decide after user review whether to drop the titlebar duplicate. Don't pre-emptively remove in TIN-190. |

## 7. Build sequence (order matters — each step verifiable on its own)

1. **Reference + spec** — land `anomalyco-opencode-desktop-layout.md` + this file first so the Reviewer + Verifier have the context checked in.
2. **Create `WorkspaceShell`** — pure presentation. Slots: `titlebar`, `sidebar`, `children`. Uses CSS grid rows `auto 1fr`; the content row is a flex row (`sidebar | main`). Default min widths come from child components; the shell only provides the container.
3. **Mount in `Workspace.tsx`** — replace the ad-hoc `<main className="tinker-workspace-shell">` with `<WorkspaceShell titlebar={<Titlebar ... />} sidebar={<WorkspaceSidebar ... />}>` + keep the existing pane runtime providers + `<PanesWorkspace>` as the child. Derive `userInitial` from `currentUserId[0].toUpperCase()` with a sensible fallback (e.g. `'T'`).
4. **Remove the stale `.tinker-workspace-shell` grid from `styles.css`** and leave only the 100%-height reset stanza. Confirm the `html, body, #root, .tinker-app` chain still fills the viewport.
5. **Tests** — add the `WorkspaceShell.test.tsx` render smoke test. Update `layout.default.test.ts` / `pane-registry.test.ts` only if the tests assert on shell structure (they currently don't — no change expected).
6. **Typecheck + lint + test** — `pnpm -r typecheck && pnpm -r lint && pnpm -r test`.
7. **Visual verify** — run `pnpm dev:desktop`, capture a screenshot, diff against Paper `9I-0`. Repeat in dark theme (`[data-theme="dark"]` on the root). Attach to the PR description.

## 8. Acceptance gates (maps 1:1 to the ticket checklist)

- [x] `agent-knowledge/reference/anomalyco-opencode-desktop-layout.md` exists with DeepWiki + GitHub citations.
- [x] `agent-knowledge/specs/2026-04-22-workspace-layout-port-design.md` exists (this file).
- [ ] Workspace renders Paper-parity sidebar + titlebar using `@tinker/design` tokens + `@tinker/panes` for content.
- [ ] Paper artboard `9I-0 Tinker Workspace — Light` parity verified in a screenshot attached to the PR.
- [ ] Split-pane with 2+ chat panes side-by-side works unchanged (regression test via manual split).
- [ ] No tabs-within-panes — each pane hosts exactly one `TinkerPaneData` kind.
- [ ] Chat / Memory / Settings / File panes still mount via `PaneRegistry<TinkerPaneData>`.
- [ ] No `dockview-react` imports added (grep-fail-gate).
- [ ] Dark + light themes both render correctly (token swap only).
- [ ] Dropped keyboard shortcuts listed with rationale in the reference doc.

## 9. Migration (existing panes + stored state)

- `WorkspaceState<TinkerPaneData>` (via `@tinker/memory/layout-store`) is untouched. Stored layouts hydrate the same way; tabs + panes continue to restore per tab.
- The sidebar is non-persisted UI — always visible, always in the same position. Nothing in stored state needs to change.
- Layout snapshot migration already handled by TIN-11 (Dockview retirement). Nothing new.

## 10. Risks + mitigations

- **Risk**: The sidebar's CSS relies on the shell being a flex parent. If we leave the old grid in place, the sidebar overflows. *Mitigation*: introduce `WorkspaceShell` and delete the competing grid rule in `styles.css` in the same PR.
- **Risk**: Adding the rail shifts the pane resizer math if `@tinker/panes` assumes it owns 100% width of its offset parent. *Mitigation*: sidebar is a flex sibling with fixed 52 px width; panes get `flex: 1 1 0; min-width: 0;` on the wrapper. Manual resize test ships in §7.7.
- **Risk**: `userInitial` derivation from `currentUserId` doesn't match the signed-in user's real display initial when the user is authenticated (TIN-84 exposes avatar + name, this spec doesn't). *Mitigation*: MVP uses the user-id first character; follow-up ticket 6.6 can swap to the real display-name initial once the Account panel is plumbed through Workspace props.
- **Risk**: Scope creep — "while we're here, let's port the command palette too." *Mitigation*: explicit non-goals in §2 + follow-ups in §6. Reviewer enforces.

## 11. Out-of-scope observations captured during research

- anomalyco persists sidebar order + expansion state per workspace (`workspaceOrder`, `workspaceExpanded`). Tinker's rail is flat + non-reorderable; no equivalent state needed.
- anomalyco's `ResizeHandle` lives at the sidebar/content boundary. Tinker's sidebar is fixed-width at 52 px (Paper 9Y-0), so no sidebar resize handle is needed. A follow-up could add one if the rail ever acquires variable-width content (labels, project tree).
- anomalyco runs a debug bar (`DebugBar` component) behind a dev flag. Tinker does not — keep absent.
- anomalyco's Titlebar distinguishes mobile vs desktop. Tinker is desktop-only; skip the mobile branch entirely.
