---
type: reference
tags: [workspace, layout, port, anomalyco, opencode, desktop, m1]
status: current
linear: TIN-190
sources:
  - https://github.com/anomalyco/opencode/tree/dev/packages/desktop
  - https://github.com/anomalyco/opencode/tree/dev/packages/app
  - https://deepwiki.com/anomalyco/opencode (wiki section 3.3, 3.4)
last_verified: '2026-04-22'
---

# anomalyco/opencode desktop — layout architecture notes

> TIN-190. Survey of the anomalyco fork of `sst/opencode`'s desktop package + its shared `@opencode-ai/app` layout, so the Tinker workspace port can copy architectural patterns without trying to translate Solid code into React verbatim.

## TL;DR

- anomalyco's **`packages/desktop` is a thin Tauri wrapper** — no layout code lives there. It wires Tauri plugins into a `Platform` object, mounts the loading splash, and renders `AppInterface` from `@opencode-ai/app`. See `packages/desktop/src/index.tsx` + `loading.tsx` + `menu.ts` + `updater.ts` + `webview-zoom.ts`.
- **All UI logic lives in the shared `packages/app` package**, which is **SolidJS**. The headline entrypoints are `packages/app/src/pages/layout.tsx` (responsive nav + resizable content), `packages/app/src/components/titlebar.tsx` (window controls + nav buttons), and `packages/app/src/pages/session/session-side-panel.tsx` (per-session tab strip via `Tabs` from `@opencode-ai/ui`).
- Split containers are built on top of `ResizeHandle` from `@opencode-ai/ui/resize-handle`.
- State management is SolidJS-flavored — `LayoutProvider`, `GlobalSync`, `SyncProvider`, `CommandProvider`, `useTheme`. None of it transfers to React as-is.
- Keyboard shortcuts register through a **single `CommandProvider` registry** with `command.register(scope, () => CommandOption[])`. Keybinds flow through a `handleKeyDown` dispatcher in `context/command.tsx`.
- The desktop target uses Tauri APIs for window drag, `setTheme`, file dialogs, notifications, and sidecar management; everything else is web-shared.

## Citations

### DeepWiki (indexed as `anomalyco/opencode`)

- Wiki section **3.3 Desktop Applications** — confirms the desktop package is a thin Tauri shell reusing `packages/app`.
- Wiki section **3.4 App Package (Shared UI Foundation)** — describes `LayoutProvider`, `GlobalSync`, `SyncProvider`, and the `Titlebar` + `Sidebar` components.
- DeepWiki ask ("what is in packages/desktop on dev branch?"): confirms SolidJS stack, enumerates file tree under `packages/desktop/src` + `packages/desktop/src-tauri`.
- DeepWiki ask ("keyboard shortcuts registered in layout.tsx?"): lists the shortcut registry shape (`command.register`) and concrete bindings — see §3 below.

### GitHub (files inspected via `gh api` + raw content fetch on `dev` branch)

- `packages/desktop/src/index.tsx` — Tauri entrypoint, mounts `AppInterface`.
- `packages/desktop/src/{loading,menu,updater,webview-zoom,i18n}.ts(x)` — platform hooks only.
- `packages/desktop/src-tauri/src/{main,lib,cli,server,windows,linux_windowing,linux_display,logging,constants}.rs` — Rust plumbing.
- `packages/app/src/pages/layout.tsx` — responsive root layout (SolidJS). 1,000+ lines; imports `ResizeHandle`, `Button`, `IconButton`, `Tooltip`, `DropdownMenu`, `Dialog` from `@opencode-ai/ui`; imports `useLayout`, `useGlobalSync`, `useCommand`, `useTheme` contexts.
- `packages/app/src/components/titlebar.tsx` — window-controls titlebar with mobile/desktop sidebar toggles + new-session button.
- `packages/app/src/pages/session/session-side-panel.tsx` — per-session tab strip using `@opencode-ai/ui/tabs`.

## 1. Shell anatomy (from `packages/app/src/pages/layout.tsx`)

Structural decomposition (SolidJS JSX collapsed to shape):

```
<Layout>
  <Titlebar />                              // window drag + sidebar toggles + new-session
  <main>
    <Sidebar>                               // responsive — mobile drawer / desktop rail
      <SortableProvider>
        <For each={projects}>
          <SortableProject>                 // expandable; contains workspaces
            <SortableProvider>
              <For each={workspaces}>
                <SortableWorkspace />       // sessions nest here
              </For>
            </SortableProvider>
          </SortableProject>
        </For>
      </SortableProvider>
    </Sidebar>
    <ResizeHandle />
    <Outlet />                              // session pane / empty state
  </main>
</Layout>
```

Key traits:

- **Responsive.** `LayoutProvider` tracks window size; the sidebar either renders as a drawer (mobile) or a persistent column (desktop).
- **Resizable.** Main content is sized via `ResizeHandle`; last-sized state is persisted per workspace in `layout.page.v1`.
- **Deep-linked.** The route carries the active project directory as base64. `navigateToProject`/`navigateToSession` encode the dir so deep links survive reloads.
- **Persisted state.** `persisted(Persist.global("layout.page", ["layout.page.v1"]), createStore({...}))` keeps `lastProjectSession`, `activeProject`, `activeWorkspace`, `workspaceOrder`, `workspaceName`, `workspaceBranchName`, `workspaceExpanded`, `gettingStartedDismissed`.

## 2. Titlebar (`packages/app/src/components/titlebar.tsx`)

- Dragging: `data-tauri-drag-region` on the outer shell; double-click triggers window maximize via Tauri `getCurrentWindow().toggleMaximize()`.
- Traffic-light OS reservation for macOS is handled via the Tauri `titleBarStyle: "Overlay"` window config, not by rendering custom lights. The component reserves a 68-px leading spacer and lets the OS paint on top.
- Primary actions on the titlebar (all `Button` / `IconButton` from `@opencode-ai/ui`):
  - **Mobile sidebar toggle** (hamburger menu) → flips `LayoutProvider.mobileSidebarOpen`.
  - **Desktop sidebar toggle** (sidebar-active / sidebar icons) → flips `LayoutProvider.desktopSidebarOpen`; renders `TooltipKeybind` showing `mod+b`.
  - **New session** (plus icon) → navigates to a brand-new session path for the active project; `TooltipKeybind` shows the registered keybind.

## 3. Keyboard shortcut registry

Shortcuts are registered in `layout.tsx` by calling `command.register(scope, () => options)`. The `CommandProvider` in `packages/app/src/context/command.tsx` owns the global dispatcher (`handleKeyDown`) and also exposes them through a command palette.

Representative bindings (not exhaustive — list per DeepWiki, not a verbatim code fetch):

| Action | Keybind |
|---|---|
| Toggle sidebar | `mod+b` |
| Open project | `mod+o` |
| Previous project | `mod+alt+arrowup` |
| Next project | `mod+alt+arrowdown` |
| Open settings | `mod+comma` |
| Toggle terminal | `ctrl+\`` |
| Open file | `mod+k, mod+p` (chord) |

Each entry is a `CommandOption` (`id`, `title`, `category`, `keybind`, `onSelect`).

## 4. State + context providers

- **`LayoutProvider`** (`@/context/layout`) — sidebar open state, sizing, active project/workspace mirror, breakpoint detection.
- **`GlobalSync`** (`@/context/global-sync`) — project/session list + SSE prefetch plumbing.
- **`SyncProvider`** — optimistic updates on the active session.
- **`CommandProvider`** — shortcut registry + palette.
- **`useTheme`** (`@opencode-ai/ui/theme/context`) — `system | light | dark` scheme; desktop also bridges via Tauri `setTheme()`.

## 5. Split container + tab strip

- **Resizable split** lives in the layout root (sidebar vs content) and inside session panes when the session has a preview surface.
- **Session tabs**: `session-side-panel.tsx` renders a tabbed strip per root session using the `Tabs` primitive from `@opencode-ai/ui`. Each tab is one child session / terminal. This is the pattern Tinker is **deliberately not porting** — Tinker uses `@tinker/panes` splits instead (see §6).

## 6. Tinker divergences (what we copy vs skip)

| Concept | anomalyco | Tinker |
|---|---|---|
| Framework | SolidJS, `@opencode-ai/ui` primitives | React 19, `@tinker/design` primitives |
| Shell grid | Titlebar + horizontal flex (sidebar + ResizeHandle + content) | Titlebar + horizontal flex (sidebar rail + `@tinker/panes` split tree) |
| Sidebar data model | projects → workspaces → sessions (persisted + sortable) | flat nav rail (Workspaces / Explorer / Chats / Skills / Agents / Connections / Memory / Playbook / Analytics / Settings / Avatar) — **MVP wires only the ones D25 ships**; rest render disabled with Paper parity only |
| Multi-session model | tabs inside one window | **panes only** — split `@tinker/panes` horizontally/vertically, each pane is one session |
| Tabs-within-panes | yes (session-side-panel) | **no** — each pane renders exactly one kind (chat/file/settings/memory) via `PaneRegistry` |
| Resizable split | `ResizeHandle` from `@opencode-ai/ui/resize-handle` | `ResizeHandle` inside `@tinker/panes` (already shipped) |
| Keyboard registry | global `CommandProvider` + palette | **deferred** — see "Dropped shortcuts" in the execution spec |
| Theme | `@opencode-ai/ui/theme/context` | `@tinker/design` tokens (D14/D23 dual-theme) |
| Persistence | `Persist.global` in SolidJS | `@tinker/memory/layout-store` via `WorkspaceState<TinkerPaneData>` (already shipped) |
| Routing | `@solidjs/router` with base64 dirs | none — Tinker is single-window; session folder is app-state, not URL state |
| Deep links | `collectNewSessionDeepLinks` / `collectOpenProjectDeepLinks` | deferred (out of MVP) |

## 7. What this port does (for TIN-190)

Reference-only summary — exact file list + build sequence lives in `agent-knowledge/specs/2026-04-22-workspace-layout-port-design.md`.

- Mount the already-built `WorkspaceSidebar` in `apps/desktop/src/renderer/workspace/Workspace.tsx` so the shell renders Titlebar + Sidebar rail + Panes content, matching Paper artboard `9I-0 Tinker Workspace — Light`.
- Reshape `apps/desktop/src/renderer/styles.css` `.tinker-workspace-shell` from a two-row grid (titlebar + content) to a two-row grid whose content row is a flex row (sidebar rail + pane area).
- Respect D25 MVP scope: only Chats / Memory / Settings / Account sidebar items are wired to real actions; the rest render disabled per the Paper artboard.
- Do not rewire `@tinker/panes` — the existing recursive split tree already delivers Tinker's panes-only multi-session model.
- Do not attempt to port `CommandProvider` / deep-link routing / per-session tab strip. File as follow-ups.

## 8. Dropped shortcuts + deferred patterns (with reasoning)

| Dropped | Reason |
|---|---|
| `mod+b` toggle sidebar | MVP sidebar is always-on; toggling adds UI state + persistence + Paper doesn't spec a hidden-sidebar mode. File follow-up if needed once sidebar visibility becomes a real user need. |
| `mod+o` open project | Tinker has no "project" concept (D25) — folder picker lives in the Chat composer per D26. |
| `mod+alt+arrowup/down` project switch | Same — no project list. |
| `mod+comma` open settings | Easy win but depends on a command dispatcher; MVP keeps Settings access via sidebar rail. File follow-up for a general shortcut registry if MVP lands and shortcuts become wanted. |
| `ctrl+\`` toggle terminal | No terminal pane in MVP (deferred per D25). |
| `mod+k,mod+p` open file | Quick-file-open is a palette feature; no palette in MVP. |

## 9. Key pointers for the next engineer

- **Don't read `layout.tsx` as a line-by-line translation target.** It's Solid spaghetti tied to `@opencode-ai/ui`, SDnd, `@solidjs/router`, and SolidJS stores. The value is in the shape (titlebar + sidebar + resizable content), not the code.
- **`@tinker/panes` already covers the split container + tab strip story.** Do not reintroduce an independent split/tab library.
- **`@tinker/design` is the sole UI token source** (D14/D23). The existing `WorkspaceSidebar.css` + `Titlebar.css` already reference tokens correctly.
- **Tauri `titleBarStyle: "Overlay"`** (shipped via TIN-182) handles the macOS traffic-light reservation. Do not render custom lights or re-implement drag regions outside the `data-tauri-drag-region` attribute.
- **`@tinker/attention`** already drives pane-frame rings + tab dots. Sidebar-card attention is post-MVP (TIN-148).
