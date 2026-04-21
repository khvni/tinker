# Paper → Tinker workspace port — design

Date: 2026-04-20
Status: draft, awaiting review
Owner: khani
Primary spec: `tinker-prd.md`

## 1. Goal

Port the seven artboards in the Paper file `Tinker Workspace` into the Tinker codebase at pixel parity in light mode (default), valid in dark mode, with no hardcoded colors in any component CSS.

| Paper artboard | Role |
|---|---|
| `9I-0` Tinker Workspace — Light | Window chrome + 2-pane layout reference (default theme) |
| `1-0` Tinker Workspace v1 | Same layout, dark theme reference |
| `9J-0` Tinker Tokens — Light | Token value reference (default) |
| `6M-0` Tinker Tokens — v1 | Token value reference (dark) |
| `IQ-0` Tinker — Memory view | Memory tab kind rendering (full-window case) |
| `IR-0` Tinker — Agents view | Agents tab kind rendering (full-window case) |
| `OK-0` Tinker — Memory refresh | Refresh modal + dialog primitive reference |

## 2. Terminology (locks the rest of the spec)

- **Window** — the app frame. Hosts TitleBar + LeftRail + ContentArea. Singleton.
- **Pane** — a split region inside ContentArea with its own tab strip. 1..N per window. Can be split horizontally or vertically, moved, resized. Maps to `@tinker/panes` `StackNode`.
- **Tab** — a content unit inside a pane. 1..N per pane, exactly one active. Can be dragged between panes. Each tab has a `kind` and `data`. Maps to `@tinker/panes` `Pane<TData>`.
- **Tab kind** — the discriminator that picks a renderer. Existing: `chat`, `today`, `scheduler`, `settings`, `playbook`, `vault-browser`, `markdown-editor`, `markdown`, `html`, `csv`, `image`, `code`, `file`. New: `memory`, `agent`.
- **`@tinker/panes` `Tab<TData>`** (library type) — top-level workspace tab that owns a recursive layout tree. Do **not** conflate with the user-visible "tab" above. Spec prose uses user terminology; code retains library names.

Paper 9I-0 confirms: one window-level `Tab<TData>` with a Split containing 2 Stacks. Each Stack holds 3 Panes. Library `Pane<TData>` = user "tab"; library `StackNode` = user "pane".

## 3. Principles applied (Musk 5-step reductions)

- **Requirements less dumb** — no SQLite for theme pref (localStorage already the pattern); no separate "audit phase" framing (8 hardcoded color lines, not a sweep); no standalone Phase 4 modal primitive (one Dialog serves ask_user + refresh); no per-component chrome subagent fanout (shared vocab → one agent).
- **Delete** — speculative tokens, per-component teams, independent code-review pass (fold into verification), TabBar engine replacement (reskin only).
- **Simplify** — localStorage sync read at boot; single headless `Dialog` primitive reused twice; unified `WorkspaceShell` for both Memory and Agents tab internals.
- **Accelerate** — three parallel subagents post-Phase 1 (chrome, memory+dialog, agents).
- **Automate** — `pnpm typecheck && pnpm test && pnpm dev` already in place; Paper parity stays manual.

## 4. Decisions locked (`decisions.md` cross-refs in brackets)

- Light mode is the default, dark opts in via `[data-theme="dark"]` on `<html>` [D23].
- All component CSS reads tokens, zero inline hex/rgba [D14].
- `@tinker/panes` is the sole workspace layout engine. Dockview is retired in this port [D16].
- `ask_user` renders as a Dialog overlay, not plain-text chat [D20].
- Co-located component folders: `ComponentName/` with `.tsx`, `index.ts`, tests, co-located CSS [D21].
- No mutate-then-call managers; pass config per-call [D22].
- Theme pref lives in `localStorage` under key `tinker.theme`. Not a secret, consistent with `VAULT_PATH_KEY` / `ONBOARDING_KEY` pattern.

## 5. Phases

### Phase 1 — theme plumbing, color fixes, `PaneKind`→`TabKind` rename

Solo, blocking.

**Deliverables:**

1. `apps/desktop/src/renderer/theme.ts` — `readTheme()`, `writeTheme(next)`, `applyTheme(theme)` helpers. `applyTheme` sets `document.documentElement.dataset.theme`. Default `'light'`.
2. `main.tsx` top-of-file: `applyTheme(readTheme() ?? 'light')` before `createRoot`. Remove `import 'dockview-react/dist/styles/dockview.css'`.
3. Fix hardcoded colors:
   - `packages/design/src/components/Button.css:91` — danger hover `rgba(239, 68, 68, 0.28)` → token
   - `packages/design/src/components/IconButton.css:88` — same
   - `packages/design/src/components/Toggle.css:8,31,32,35,36,37,51` — knob + track alpha variants → tokens
   - `packages/design/src/components/SegmentedControl.css:33` — box-shadow rgba → token
   - Add tokens in `tokens.css` only when reuse or theme split demands it. Otherwise use existing `--color-error-soft` / `--color-border-*`.
4. Rename `PaneKind` → `TabKind` in `packages/shared-types/src/layout.ts` and all call sites. Type-only, mechanical. Leave `LayoutState.dockviewModel` field (deleted in Phase 2).
5. Verify `?route=design-system` renders correctly in `:root` (light) and `document.documentElement.dataset.theme = 'dark'` (manual QA).

**Tests:** unit tests for `readTheme/writeTheme/applyTheme`; snapshot of design-system route in both themes if possible, else manual screenshot vs Paper 6M-0 + 9J-0.

### Phase 2 — `@tinker/panes` cutover + window/pane chrome port

One subagent; blocks Phase 3a/3b.

**Deliverables:**

1. Migrate `Workspace.tsx` root from `DockviewReact` to `@tinker/panes` React components. Use `createWorkspaceStore` + `WorkspaceState<TData>` from `@tinker/panes`.
2. Move each existing `TabKind` renderer (`chat`, `today`, `scheduler`, `settings`, `playbook`, `vault-browser`, `markdown-editor`, `markdown`, `html`, `csv`, `image`, `code`, `file`) off `IDockviewPanelProps` onto a `@tinker/panes`-native renderer registry. Component bodies stay; only the panel wrapper changes.
3. Port window + pane chrome as co-located folders under `apps/desktop/src/renderer/workspace/components/`:
   - `TitleBar/` — traffic lights + "Tinker" label + window actions. Hosts theme toggle `IconButton` (sun/moon glyph).
   - `LeftRail/` — 52px icon rail: Workspaces (active), Explorer, Chats, Skills, Agents, Connections, Memory, divider, NewTab, bottom: Playbook, Analytics, Settings, Avatar.
   - `PaneTabBar/` — per-pane tab strip. Reskin `@tinker/panes` default tab strip via CSS; no new primitive.
   - `StatusDock/` — LeftPane footer (187px) in 9I-0.
   - `PreviewFrame/` — RightPane body stack: `FileHeader` + `PreviewToolbar` + `PreviewCanvas` + `PreviewFooter` + `PreviewMeta`.
   - `JumpToBottom/` — scroll affordance inside ChatScroll.
4. Update `packages/shared-types/src/layout.ts` `LayoutState`: replace `dockviewModel: unknown` with `workspaceState: WorkspaceState<unknown>`. Bump version to `2`. Provide one-shot migration that discards legacy dockview snapshots (log + new default layout).
5. Delete `dockview-react` dependency from `apps/desktop/package.json`. Delete `workspace/DockviewContext.ts`. Delete the legacy types in `workspace/pane-registry.ts`.

**Paper source:** artboard `1-0` and `9I-0` (identical structure, different theme). Pull JSX + computed styles via `/paper-desktop:design-to-code`. Never guess values from screenshots.

**Tests:** existing `chat-panels.test.ts`, `file-open.test.ts` migrate to new store API. Add `Workspace.test.tsx` snapshot covering split-pane restoration.

### Phase 3a — Memory tab kind + `Dialog` primitive + RefreshModal

One subagent, parallel with Phase 2 engine work where independent, sequenced after Phase 2 cutover lands.

**Deliverables:**

1. Add `'memory'` to `TabKind` in `shared-types`.
2. `packages/design/src/components/Dialog/` — headless primitive. Exports `Dialog`, `DialogOverlay`, `DialogHeader`, `DialogBody`, `DialogFooter`. Uses `createPortal` from `react-dom`. Focus trap + Esc handling configurable via prop (per [D20] ask_user must gate Esc on `cancel` option).
3. `apps/desktop/src/renderer/renderers/MemoryTab/` — internal 2-col layout (280px sidebar + detail). Sidebar: SearchRow + SectionList. Detail: DetailTabBar + DetailHeader + DetailBody. Data from `@tinker/memory`'s `MemoryStore`.
4. `apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal/` — consumes `Dialog`. Progress + action surface per OK-0 `UE-0` / `UF-0` / `UM-0` / `UN-0` nodes.
5. Wire memory refresh trigger in TitleBar or Memory tab toolbar (decision surfaced in-port, not hardcoded here).

**Paper source:** artboards `IQ-0` and `OK-0`.

**Tests:** `Dialog.test.tsx` — focus trap, Esc gating, portal mount. `MemoryTab.test.tsx` — entity selection, detail pane swap, empty state.

### Phase 3b — Agents tab kind

One subagent, parallel with 3a. Sequenced after Phase 2.

**Deliverables:**

1. Add `'agent'` to `TabKind` in `shared-types`.
2. `apps/desktop/src/renderer/renderers/AgentsTab/` — internal 2-col layout (280px sidebar + detail). Sidebar: SearchRow + SectionList. Detail: DetailTabBar + DetailHeader + DetailBody.
3. Data source: bridge session list (`client.session.list`) for concurrent agent runs; optional scheduler run history overlay if DetailTabBar Paper labels indicate "Runs" tab. Confirm from Paper labels during build; do not pre-bind here.

**Paper source:** artboard `IR-0`.

**Tests:** `AgentsTab.test.tsx` — agent selection, run detail render, empty state.

### Phase 3c — `ask_user` overlay in Chat renderer

One subagent, small. Serial after 3a merges.

**Deliverables:**

1. Chat renderer subscribes to `ask_user` events from `@tinker/bridge`.
2. Renders `Dialog` overlay with `{ id, prompt, options[] }` per [D20]. Resolves via button click into typed agent reply.
3. Esc gated on `options` including `{ id: 'cancel' }`.

**Tests:** overlay resolve path unit-tested. Integration snapshot with mock bridge event stream.

## 6. Agent team layout

| Team | Phase | Entry skills | Exit gate |
|---|---|---|---|
| Plumbing | 1 | TDD theme helper, `/paper-desktop:get_jsx` on 6M-0 + 9J-0 for token cross-check, `/interface-design` for color reduction sanity | design-system route matches Paper tokens artboards; typecheck + test green |
| Engine-and-chrome | 2 | `/paper-desktop:design-to-code` artboard 1-0, `/interface-design`, `/impeccable` | `dockview-react` removed from package.json; all existing tab kinds render; split + move + persist work end-to-end |
| Memory-and-dialog | 3a | `/paper-desktop:design-to-code` IQ-0 + OK-0, `/interface-design`, TDD for `Dialog` | Memory tab renders both themes at parity; RefreshModal visible at parity to OK-0 |
| Agents | 3b | `/paper-desktop:design-to-code` IR-0, `/interface-design`, `/impeccable` | Agents tab renders both themes at parity |
| Ask-user | 3c | TDD overlay resolution | Overlay fires on bridge event, resolves to typed reply, Esc gated correctly |

Each subagent runs `/superpowers:test-driven-development` for logic, writes conventional commits scoped per package, respects CLAUDE.md coding standards, and invokes `/paper-desktop:finish_working_on_nodes` at the end of its run.

## 7. Dependencies between phases

```
Phase 1 ─► Phase 2 ─┬─► Phase 3a ─► Phase 3c
                    └─► Phase 3b
```

Phase 3a + 3b can overlap. 3c is a small follow-up dependent on `Dialog` landing in 3a.

## 8. Verification gate (before any phase merges into main)

1. `pnpm typecheck` clean.
2. `pnpm test` green across all workspace packages.
3. `pnpm dev` boots without console errors.
4. Light-mode visual comparison against the matching Paper artboards passes for the components touched.
5. Dark-mode verification (`document.documentElement.dataset.theme = 'dark'`) passes against `1-0` / `6M-0`.
6. `/superpowers:verification-before-completion` run per phase.
7. CLAUDE.md updated when the component tree or theme plumbing shifts the public mental model (Phase 1 and Phase 2 both require it).

## 9. Out of scope

- Cloud sync, ElectricSQL, device-to-device pairing [D18].
- Attention coordinator rings / flashes [D19] — separate feature, not this port.
- Mobile companion or headless runtime.
- Light-mode palette rework — tokens already landed in commits `8b863ce`, `f153190`, `532cb70`.
- `prefers-color-scheme` media-query respect — single `[data-theme]` attribute sets the mode [D23].

## 10. Open risks

- **Layout migration**: discarding legacy `dockviewModel` snapshots on version bump will reset existing users' saved layouts. Acceptable for pre-release; flag for release-notes if shipped to beta.
- **Dialog Esc gating**: library-level decision whether Esc is consumed or propagated. Default in primitive must be "propagate" so tab-level shortcuts still work; consumer opts into capture.
- **Agents data source**: Paper IR-0's `DetailTabBar` labels will determine the exact data contract. Subagent confirms from Paper before building.

## 11. References

- `tinker-prd.md`
- `CLAUDE.md` sections 8, 9, 10
- `agent-knowledge/product/decisions.md` — D14, D15, D16, D17, D20, D21, D22, D23
- `agent-knowledge/features/10-tinker-panes.md`
- `agent-knowledge/reference/panes-heritage.md`
- `.local-reference/ramp-glass/` — workspace philosophy (Goddijn § "workspace, not a chat window")
